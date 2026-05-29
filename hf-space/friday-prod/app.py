"""
F.R.I.D.A.Y. protótipo HF — smolagents + config gerada do repo OpenClaw.
Produção Jarvis: EC2 + gateway Vercel (ver docs/HF-DEPLOY-FRIDAY.md).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from tools import TOOL_REGISTRY

app = FastAPI(title="OpenClaw F.R.I.D.A.Y. (HF prototype)", version="0.1.0")

CONFIG_PATH = Path(__file__).parent / "agents-config.yaml"
_agents_cache: dict[str, Any] | None = None
_runtime_agents: dict[str, Any] = {}

# Último recurso quando primary/fallbacks do agente falham (429/404)
GLOBAL_OPENROUTER_FALLBACKS = [
    "poolside/laguna-xs.2:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
]


def load_config() -> dict[str, Any]:
    global _agents_cache
    if _agents_cache is not None:
        return _agents_cache
    with CONFIG_PATH.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    _agents_cache = {k: v for k, v in raw.items() if not str(k).startswith("_") and k != "defaults"}
    return _agents_cache


def _resolve_tools(names: list[str]) -> list:
    out = []
    for name in names or []:
        fn = TOOL_REGISTRY.get(name)
        if fn:
            out.append(fn)
    return out


def _normalize_openrouter_model_id(model_id: str) -> str:
    """OpenRouter API espera id cru (ex. google/gemma-…:free), sem prefixo openrouter/."""
    mid = (model_id or "").strip()
    if mid.startswith("openrouter/"):
        mid = mid[len("openrouter/") :]
    return mid


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

    raise RuntimeError("; ".join(errors) if errors else "OpenRouter falhou")


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

    if openrouter_key:
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


class RunRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=8000)
    agent_id: str | None = None


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

    def run(self, task: str, agent_id: str | None = None) -> dict[str, Any]:
        target = agent_id or "orchestrator"
        if target not in self.configs:
            raise HTTPException(404, f"Agente desconhecido: {target}")

        cfg = self.configs[target]
        tool_names = cfg.get("tools") or []

        if not tool_names and os.environ.get("OPENROUTER_API_KEY", "").strip():
            try:
                result = _run_openrouter_chat(task, cfg)
                out = {"ok": True, "mode": "openrouter-chat", "agent_id": target, "result": result}
                if os.environ.get("HF_LEARNING_AUTO", "").lower() in ("1", "true", "yes"):
                    from sync import append_learning

                    append_learning(target, f"{task}\n---\n{out['result']}")
                return out
            except Exception as e:
                return {"ok": False, "agent_id": target, "error": str(e)}

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
            if os.environ.get("HF_LEARNING_AUTO", "").lower() in ("1", "true", "yes"):
                from sync import append_learning

                append_learning(target, f"{task}\n---\n{out['result']}")
            return out
        except Exception as e:
            return {"ok": False, "agent_id": target, "error": str(e)}


orch = Orquestrador()


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "friday-prod",
        "openrouter": bool(os.environ.get("OPENROUTER_API_KEY")),
        "hf_token": bool(os.environ.get("HF_TOKEN")),
        "gateway": bool(os.environ.get("OPENCLAW_GATEWAY_BASE_URL")),
    }


@app.get("/agents")
def agents():
    return {"ok": True, "agents": orch.list_agents()}


@app.post("/run")
def run(req: RunRequest):
    return orch.run(req.task, req.agent_id)


@app.post("/run/{agent_id}")
def run_agent(agent_id: str, req: RunRequest):
    return orch.run(req.task, agent_id)


@app.on_event("startup")
def _default_agent_hint():
    default = os.environ.get("DEFAULT_AGENT", "").strip()
    if default:
        print(f"friday-prod: DEFAULT_AGENT={default} — POST /run/{default}")
