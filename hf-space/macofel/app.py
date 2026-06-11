"""
F.R.I.D.A.Y. protótipo HF — smolagents + config gerada do repo OpenClaw.
Produção Jarvis: EC2 + gateway Vercel (ver docs/HF-DEPLOY-FRIDAY.md).
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from tools import TOOL_REGISTRY
from lib.innovation_runner import INNOVATION_HANDLERS, extract_topic
from lib.monitor import build_status, start_keepalive
from lib.corpus_client import search_corpus

_PUBLIC = Path(__file__).parent / "public"
SPACE_PROFILE = (os.environ.get("SPACE_PROFILE") or "unified").strip().lower()

app = FastAPI(title="OpenClaw F.R.I.D.A.Y. (HF prototype)", version="0.2.0")

CONFIG_PATH = Path(__file__).parent / "agents-config.yaml"
_agents_cache: dict[str, Any] | None = None
_runtime_agents: dict[str, Any] = {}

# Agentes que preferem Kilo Gateway (construcao / codegen)
KILO_AGENT_IDS = {"hefestos"}

# Inovacao: tools deterministicas (Fase 2+) — antes de OpenRouter/smolagents
INNOVATION_AGENT_IDS = set(INNOVATION_HANDLERS.keys())  # incl. hefestos (proposta)
KILO_GATEWAY_BASE_DEFAULT = "https://api.kilo.ai/api/gateway"

# Ultimo recurso quando primary/fallbacks do agente falham (429/404)
GLOBAL_OPENROUTER_FALLBACKS = [
    "poolside/laguna-xs.2:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
]

DEFAULT_HF_INFERENCE_MODEL = "HuggingFaceH4/zephyr-7b-beta"


def _openrouter_disabled() -> bool:
    v = (os.environ.get("FRIDAY_DISABLE_OPENROUTER") or os.environ.get("OPENROUTER_DISABLED") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _is_quota_error(msg: str) -> bool:
    m = (msg or "").lower()
    return "402" in m or "insufficient balance" in m or "depleted" in m or "payment required" in m


def load_config() -> dict[str, Any]:
    global _agents_cache
    if _agents_cache is not None:
        return _agents_cache
    with CONFIG_PATH.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    profile_agents = {
        "core": {"heimdall", "vp-pecas", "veldora", "rimuru", "dedalo", "icaro"},
        "innovation": {"sophia", "yato", "senku", "gideon", "hefestos", "rebeca"},
        "macofel": {"macofel"},
    }
    allowed = profile_agents.get(SPACE_PROFILE)
    _agents_cache = {
        k: v
        for k, v in raw.items()
        if not str(k).startswith("_") and k != "defaults" and (not allowed or k in allowed)
    }
    return _agents_cache


def _resolve_tools(names: list[str]) -> list:
    out = []
    for name in names or []:
        fn = TOOL_REGISTRY.get(name)
        if fn:
            out.append(fn)
    return out


HF_OPENROUTER_FALLBACK = "google/gemma-4-26b-a4b-it:free"


def _normalize_openrouter_model_id(model_id: str) -> str:
    """OpenRouter API espera id cru (ex. google/gemma-…:free), sem prefixo openrouter/."""
    mid = (model_id or "").strip()
    if mid.startswith("openrouter/"):
        mid = mid[len("openrouter/") :]
    if mid.startswith("ollama/") or (":" in mid and "/" not in mid):
        return HF_OPENROUTER_FALLBACK
    return mid or HF_OPENROUTER_FALLBACK


def _agent_code_name(agent_id: str, cfg: dict[str, Any]) -> str:
    """smolagents exige name como identificador Python válido."""
    display = (cfg.get("name") or agent_id or "").strip()
    if display.isidentifier() and display not in {"class", "def", "return"}:
        return display
    safe = agent_id.replace("-", "_")
    return safe if safe.isidentifier() else "agent"


def _run_openrouter_chat(task: str, cfg: dict[str, Any]) -> str:
    """Chat directo OpenRouter — mais rápido que CodeAgent para agentes sem tools."""
    import httpx

    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise ValueError("OPENROUTER_API_KEY em falta")

    primary = _normalize_openrouter_model_id(cfg.get("model") or cfg.get("model_ref") or "")
    fallbacks = [_normalize_openrouter_model_id(m) for m in (cfg.get("fallbacks") or [])]
    seen: set[str] = set()
    models: list[str] = []
    for mid in [primary, *fallbacks, *GLOBAL_OPENROUTER_FALLBACKS]:
        if mid and mid not in seen:
            seen.add(mid)
            models.append(mid)

    system = cfg.get("description") or cfg.get("role") or "Assistente OpenClaw"
    errors: list[str] = []

    for model_id in models:
        try:
            r = httpx.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://aldebaran-lw-friday-prod.hf.space",
                    "X-Title": "OpenClaw F.R.I.D.A.Y.",
                },
                json={
                    "model": model_id,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": task},
                    ],
                    "max_tokens": min(int(cfg.get("max_tokens") or 2048), 4096),
                    "temperature": float(cfg.get("temperature") or 0.7),
                },
                timeout=90.0,
            )
            if r.status_code >= 400:
                errors.append(f"{model_id}: HTTP {r.status_code}")
                continue
            data = r.json()
            content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
            if content:
                return str(content).strip()
            errors.append(f"{model_id}: resposta vazia")
        except Exception as e:
            errors.append(f"{model_id}: {e}")

    err_text = "; ".join(errors) if errors else "OpenRouter falhou"
    raise RuntimeError(err_text)


def _ollama_api_base() -> str:
    return (os.environ.get("OLLAMA_API_URL") or "").strip().rstrip("/")


def _run_ollama_chat(task: str, cfg: dict[str, Any]) -> str:
    """Último recurso: Ollama na EC2 (OLLAMA_API_URL). Requer porta acessível do Space."""
    import httpx

    base = _ollama_api_base()
    if not base:
        raise ValueError("OLLAMA_API_URL em falta")

    model = (os.environ.get("OLLAMA_MODEL") or "smollm2:360m").strip()
    system = cfg.get("description") or cfg.get("role") or "Assistente OpenClaw"
    max_tokens = min(int(cfg.get("max_tokens") or 2048), 4096)

    r = httpx.post(
        f"{base}/api/chat",
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": task},
            ],
            "stream": False,
            "options": {"num_predict": max_tokens},
        },
        timeout=120.0,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"ollama/{model}: HTTP {r.status_code} {r.text[:200]}")
    data = r.json()
    content = (data.get("message") or {}).get("content")
    if content:
        return str(content).strip()
    raise RuntimeError(f"ollama/{model}: resposta vazia")


def _run_hf_inference_chat(task: str, cfg: dict[str, Any]) -> str:
    """Chat via HF Inference (HF_TOKEN) — fallback quando OpenRouter 402 ou desactivado."""
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        raise ValueError("HF_TOKEN em falta")

    model_id = (cfg.get("hf_inference_model") or DEFAULT_HF_INFERENCE_MODEL).strip()
    system = cfg.get("description") or cfg.get("role") or "Assistente OpenClaw"
    max_tokens = min(int(cfg.get("max_tokens") or 2048), 4096)
    temperature = float(cfg.get("temperature") or 0.7)
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": task},
    ]

    try:
        from huggingface_hub import InferenceClient

        client = InferenceClient(model=model_id, token=token)
        out = client.chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        choices = out.choices if hasattr(out, "choices") else (out.get("choices") if isinstance(out, dict) else [])
        if choices:
            first = choices[0]
            msg = first.message if hasattr(first, "message") else first.get("message", {})
            content = msg.content if hasattr(msg, "content") else msg.get("content")
            if content:
                return str(content).strip()
    except Exception as hub_err:
        import httpx

        r = httpx.post(
            f"https://api-inference.huggingface.co/models/{model_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"inputs": f"{system}\n\nUser: {task}\nAssistant:", "parameters": {"max_new_tokens": max_tokens}},
            timeout=120.0,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"{model_id}: HTTP {r.status_code} ({hub_err})") from hub_err
        data = r.json()
        if isinstance(data, list) and data and data[0].get("generated_text"):
            return str(data[0]["generated_text"]).strip()
        if isinstance(data, dict) and data.get("generated_text"):
            return str(data["generated_text"]).strip()
        raise RuntimeError(f"{model_id}: resposta vazia ({hub_err})") from hub_err

    raise RuntimeError(f"{model_id}: resposta vazia")


def _kilo_base_url() -> str:
    return (os.environ.get("KILO_GATEWAY_BASE_URL") or KILO_GATEWAY_BASE_DEFAULT).rstrip("/")


def _run_kilo_chat(task: str, cfg: dict[str, Any]) -> str:
    """Chat via Kilo Gateway — preferido para Hefestos (build/codegen)."""
    import httpx

    key = os.environ.get("KILO_API_KEY", "").strip()
    if not key:
        raise ValueError("KILO_API_KEY em falta")

    primary = (cfg.get("kilo_model") or cfg.get("model") or "kilo-auto/free").strip()
    fallbacks = [str(m).strip() for m in (cfg.get("kilo_fallbacks") or cfg.get("fallbacks") or []) if str(m).strip()]
    seen: set[str] = set()
    models: list[str] = []
    for mid in [primary, *fallbacks, "kilo-auto/free"]:
        if mid and mid not in seen:
            seen.add(mid)
            models.append(mid)

    system = cfg.get("description") or cfg.get("role") or "Assistente OpenClaw"
    errors: list[str] = []
    base = _kilo_base_url()

    for model_id in models:
        try:
            r = httpx.post(
                f"{base}/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_id,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": task},
                    ],
                    "max_tokens": min(int(cfg.get("max_tokens") or 2048), 4096),
                    "temperature": float(cfg.get("temperature") or 0.7),
                },
                timeout=90.0,
            )
            if r.status_code >= 400:
                errors.append(f"{model_id}: HTTP {r.status_code}")
                continue
            data = r.json()
            content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
            if content:
                return str(content).strip()
            errors.append(f"{model_id}: resposta vazia")
        except Exception as e:
            errors.append(f"{model_id}: {e}")

    raise RuntimeError("; ".join(errors) if errors else "Kilo Gateway falhou")


def _build_smol_agent(agent_id: str, cfg: dict[str, Any]):
    try:
        from smolagents import CodeAgent, InferenceClientModel, OpenAIModel
    except ImportError:
        return None

    tools = _resolve_tools(cfg.get("tools") or [])
    raw_model = cfg.get("model") or cfg.get("model_ref") or "HuggingFaceH4/zephyr-7b-beta"
    max_tokens = int(cfg.get("max_tokens") or 2048)
    temperature = float(cfg.get("temperature") or 0.7)

    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    hf_token = os.environ.get("HF_TOKEN", "").strip()
    kilo_key = os.environ.get("KILO_API_KEY", "").strip()

    skip_or = bool(cfg.get("llm_skip_openrouter")) or _openrouter_disabled()
    hf_model = (cfg.get("hf_inference_model") or DEFAULT_HF_INFERENCE_MODEL).strip()

    if agent_id in KILO_AGENT_IDS and kilo_key:
        model_id = (cfg.get("kilo_model") or cfg.get("model") or "kilo-auto/free").strip()
        model = OpenAIModel(
            model_id=model_id,
            api_base=_kilo_base_url(),
            api_key=kilo_key,
            max_tokens=max_tokens,
            temperature=temperature,
            flatten_messages_as_text=True,
        )
    elif hf_token and (skip_or or not openrouter_key):
        model_id = hf_model if "/" in hf_model else f"HuggingFaceH4/{hf_model}"
        model = InferenceClientModel(
            model_id=model_id,
            token=hf_token,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    elif openrouter_key and not skip_or:
        model_id = _normalize_openrouter_model_id(raw_model)
        model = OpenAIModel(
            model_id=model_id,
            api_base="https://openrouter.ai/api/v1",
            api_key=openrouter_key,
            max_tokens=max_tokens,
            temperature=temperature,
            flatten_messages_as_text=True,
        )
    elif hf_token:
        model_id = raw_model if "/" in raw_model else f"HuggingFaceH4/{raw_model}"
        model = InferenceClientModel(
            model_id=model_id,
            token=hf_token,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    else:
        return None

    return CodeAgent(
        model=model,
        tools=tools,
        name=_agent_code_name(agent_id, cfg),
        description=cfg.get("description") or cfg.get("role") or "",
        max_steps=10,
    )


def get_agent(agent_id: str):
    if agent_id in _runtime_agents:
        return _runtime_agents[agent_id]
    configs = load_config()
    if agent_id not in configs:
        raise KeyError(agent_id)
    agent = _build_smol_agent(agent_id, configs[agent_id])
    _runtime_agents[agent_id] = agent
    return agent


def _learning_auto_enabled() -> bool:
    flag = os.environ.get("HF_LEARNING_AUTO", "true").strip().lower()
    if flag in ("0", "false", "no", "off"):
        return False
    return bool(os.environ.get("HF_TOKEN", "").strip())


def _persist_learning(agent_id: str, task: str, result: str, mode: str) -> None:
    """Grava learning no Dataset HF em background (nao bloqueia /run)."""
    if not _learning_auto_enabled():
        return

    def _write() -> None:
        try:
            from sync import append_learning

            text = f"task:\n{task[:2000]}\n---\nresult:\n{str(result)[:1800]}"
            r = append_learning(agent_id, text, mode=mode)
            if not r.get("ok"):
                print(
                    json.dumps(
                        {
                            "event": "learning_persist_failed",
                            "agent": agent_id,
                            "mode": mode,
                            "status": r.get("status"),
                            "error": r.get("error") or r.get("body"),
                        },
                        ensure_ascii=False,
                    )
                )
        except Exception as e:
            print(
                json.dumps(
                    {"event": "learning_persist_error", "agent": agent_id, "error": str(e)},
                    ensure_ascii=False,
                )
            )

    threading.Thread(target=_write, daemon=True).start()


class RunRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=8000)
    agent_id: str | None = None
    context: dict[str, Any] | None = None


class Orquestrador:
    """Coordena agentes; delega por agent_id ou usa orchestrator."""

    def __init__(self):
        self.configs = load_config()

    def list_agents(self) -> list[dict[str, Any]]:
        return [
            {
                "id": aid,
                "name": c.get("name"),
                "forge_alias": c.get("forge_alias"),
                "role": c.get("role"),
                "model": c.get("model"),
                "tools": c.get("tools") or [],
                "skills": c.get("skills") or [],
            }
            for aid, c in self.configs.items()
        ]

    def run(
        self,
        task: str,
        agent_id: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        target = agent_id or "orchestrator"
        if target not in self.configs and target not in INNOVATION_AGENT_IDS:
            raise HTTPException(404, f"Agente desconhecido: {target}")

        if target in INNOVATION_AGENT_IDS:
            topic = extract_topic(task, context)
            try:
                handler = INNOVATION_HANDLERS[target]
                out = handler(topic, ctx=context)
                _persist_learning(
                    target,
                    task,
                    json.dumps(out.get("result") or out, ensure_ascii=False)[:1800],
                    out.get("mode", "innovation"),
                )
                return out
            except Exception as e:
                return {"ok": False, "agent_id": target, "error": str(e)}

        cfg = self.configs[target]
        tool_names = cfg.get("tools") or []

        if target in KILO_AGENT_IDS and os.environ.get("KILO_API_KEY", "").strip():
            try:
                result = _run_kilo_chat(task, cfg)
                out = {"ok": True, "mode": "kilo-chat", "agent_id": target, "result": result}
                if os.environ.get("HF_LEARNING_AUTO", "").lower() in ("1", "true", "yes"):
                    from sync import append_learning

                    append_learning(target, f"{task}\n---\n{out['result']}")
                return out
            except Exception as e:
                return {"ok": False, "agent_id": target, "error": str(e)}

        if not tool_names:
            hf_token = os.environ.get("HF_TOKEN", "").strip()
            skip_or = bool(cfg.get("llm_skip_openrouter")) or _openrouter_disabled()
            or_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
            ollama_url = _ollama_api_base()

            def _finish_ollama(prior: str) -> dict[str, Any] | None:
                if not ollama_url:
                    return None
                try:
                    result = _run_ollama_chat(task, cfg)
                    out = {
                        "ok": True,
                        "mode": "ollama-fallback",
                        "agent_id": target,
                        "result": result,
                        "fallback_from": prior,
                    }
                    _persist_learning(target, task, result, "ollama-fallback")
                    return out
                except Exception:
                    return None

            if skip_or and hf_token:
                try:
                    result = _run_hf_inference_chat(task, cfg)
                    out = {"ok": True, "mode": "hf-inference-chat", "agent_id": target, "result": result}
                    _persist_learning(target, task, result, "hf-inference-chat")
                    return out
                except Exception as e:
                    ollama_out = _finish_ollama("hf-inference")
                    if ollama_out:
                        return ollama_out
                    return {"ok": False, "agent_id": target, "error": str(e)}

            if or_key and not skip_or:
                try:
                    result = _run_openrouter_chat(task, cfg)
                    out = {"ok": True, "mode": "openrouter-chat", "agent_id": target, "result": result}
                    _persist_learning(target, task, result, "openrouter-chat")
                    return out
                except Exception as e:
                    err = str(e)
                    if hf_token and _is_quota_error(err):
                        try:
                            result = _run_hf_inference_chat(task, cfg)
                            out = {
                                "ok": True,
                                "mode": "hf-inference-chat",
                                "agent_id": target,
                                "result": result,
                                "fallback_from": "openrouter-quota",
                            }
                            _persist_learning(target, task, result, "hf-inference-chat")
                            return out
                        except Exception as hf_e:
                            ollama_out = _finish_ollama("openrouter+hf")
                            if ollama_out:
                                return ollama_out
                            return {
                                "ok": False,
                                "agent_id": target,
                                "error": f"openrouter: {err}; hf: {hf_e}",
                            }
                    ollama_out = _finish_ollama("openrouter")
                    if ollama_out:
                        return ollama_out
                    return {"ok": False, "agent_id": target, "error": err}

            if hf_token and not or_key:
                try:
                    result = _run_hf_inference_chat(task, cfg)
                    out = {"ok": True, "mode": "hf-inference-chat", "agent_id": target, "result": result}
                    _persist_learning(target, task, result, "hf-inference-chat")
                    return out
                except Exception as e:
                    ollama_out = _finish_ollama("hf-inference")
                    if ollama_out:
                        return ollama_out
                    return {"ok": False, "agent_id": target, "error": str(e)}

            if ollama_url:
                ollama_out = _finish_ollama("direct")
                if ollama_out:
                    return ollama_out

        try:
            agent = get_agent(target)
        except Exception as e:
            return {"ok": False, "agent_id": target, "error": f"init: {e}"}

        if agent is None:
            cfg = self.configs[target]
            return {
                "ok": True,
                "mode": "stub",
                "agent_id": target,
                "message": (
                    f"[stub] {cfg.get('name')}: configure OPENROUTER_API_KEY ou HF_TOKEN. "
                    f"Tarefa recebida ({len(task)} chars): {task[:200]}…"
                ),
                "tools_available": list((cfg.get("tools") or [])),
            }

        try:
            result = agent.run(task)
            out = {"ok": True, "mode": "smolagents", "agent_id": target, "result": str(result)}
            _persist_learning(target, task, str(result), "smolagents")
            return out
        except Exception as e:
            return {"ok": False, "agent_id": target, "error": str(e)}


orch = Orquestrador()


@app.get("/", response_class=HTMLResponse)
def root_dashboard():
    """Painel F.R.I.D.A.Y. — substitui openclaw-demo (Space único)."""
    dash = _PUBLIC / "dashboard.html"
    if dash.is_file():
        return FileResponse(dash, media_type="text/html; charset=utf-8")
    return HTMLResponse("<h1>friday-prod</h1><p>dashboard.html em falta</p>")


@app.get("/api/info")
def api_info():
    """Metadados da API — antigo GET /."""
    configs = load_config()
    return {
        "ok": True,
        "service": "friday-prod",
        "space_profile": SPACE_PROFILE,
        "note": "OpenClaw HF por perfil; Jarvis/Telegram na EC2; Macofel em instancia propria.",
        "endpoints": {
            "dashboard": "GET /",
            "health": "GET /health",
            "status": "GET /api/status",
            "agents": "GET /agents",
            "run": "POST /run",
            "run_agent": "POST /run/{agent_id}",
            "pipeline": "POST /run/pipeline",
            "innovation_agents": sorted(INNOVATION_AGENT_IDS),
            "corpus_search": "GET /corpus/search?q=...&agent=",
            "openapi": "GET /docs",
        },
        "agent_count": len(configs),
        "openrouter": bool(os.environ.get("OPENROUTER_API_KEY")),
        "kilo": bool(os.environ.get("KILO_API_KEY")),
        "hf_token": bool(os.environ.get("HF_TOKEN")),
        "ollama": bool(_ollama_api_base()),
        "gateway": bool(os.environ.get("OPENCLAW_GATEWAY_BASE_URL")),
        "learning_auto": _learning_auto_enabled(),
        "keepalive_ms": int(os.environ.get("KEEPALIVE_MS", "240000")),
    }


@app.get("/api/status")
def api_status():
    """Monitor portfólio — migrado do Space openclaw-demo."""
    try:
        data = build_status()
        code = 200 if data.get("ok") else 502
        return JSONResponse(content=data, status_code=code)
    except Exception as e:
        raise HTTPException(502, str(e)) from e


@app.get("/gateway")
def gateway_legacy():
    """Compatível com openclaw-demo /gateway."""
    data = build_status()
    health_ok = (data.get("gateway") or {}).get("health", {}).get("ok")
    code = 200 if health_ok else 502
    return JSONResponse(content=data, status_code=code)


@app.get("/corpus/search")
def corpus_search(q: str, agent: str | None = None, limit: int = 5):
    return search_corpus(q, agent=agent, limit=min(limit, 10))


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "friday-prod",
        "space_profile": SPACE_PROFILE,
        "openrouter": bool(os.environ.get("OPENROUTER_API_KEY")),
        "kilo": bool(os.environ.get("KILO_API_KEY")),
        "hf_token": bool(os.environ.get("HF_TOKEN")),
        "ollama": bool(_ollama_api_base()),
        "gateway": bool(os.environ.get("OPENCLAW_GATEWAY_BASE_URL")),
        "learning_auto": _learning_auto_enabled(),
        "backup_dataset": os.environ.get("HF_BACKUP_DATASET", "Aldebaran-LW/openclaw-backup"),
        "keepalive_ms": int(os.environ.get("KEEPALIVE_MS", "240000")),
    }


@app.get("/agents")
def agents():
    return {"ok": True, "agents": orch.list_agents()}


@app.post("/run")
def run(req: RunRequest):
    return orch.run(req.task, req.agent_id, req.context)


@app.post("/run/pipeline")
def run_pipeline(req: RunRequest):
    return orch.run(req.task, "pipeline", req.context)


@app.post("/run/{agent_id}")
def run_agent(agent_id: str, req: RunRequest):
    return orch.run(req.task, agent_id, req.context)


@app.on_event("startup")
def _on_startup():
    start_keepalive()
    default = os.environ.get("DEFAULT_AGENT", "").strip()
    if default:
        print(f"friday-prod: DEFAULT_AGENT={default} — POST /run/{default}")
