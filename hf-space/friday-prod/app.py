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


def _build_smol_agent(agent_id: str, cfg: dict[str, Any]):
    try:
        from smolagents import CodeAgent, InferenceClientModel, OpenAIModel
    except ImportError:
        return None

    tools = _resolve_tools(cfg.get("tools") or [])
    model_id = cfg.get("model") or "HuggingFaceH4/zephyr-7b-beta"
    max_tokens = int(cfg.get("max_tokens") or 2048)
    temperature = float(cfg.get("temperature") or 0.7)

    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    hf_token = os.environ.get("HF_TOKEN", "").strip()

    if openrouter_key:
        model = OpenAIModel(
            model_id=f"openrouter/{model_id}" if not model_id.startswith("openrouter/") else model_id,
            api_base="https://openrouter.ai/api/v1",
            api_key=openrouter_key,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    elif hf_token:
        model = InferenceClientModel(
            model_id=model_id if "/" in model_id else f"HuggingFaceH4/{model_id}",
            token=hf_token,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    else:
        return None

    return CodeAgent(
        model=model,
        tools=tools,
        name=cfg.get("name") or agent_id,
        description=cfg.get("description") or cfg.get("role") or "",
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

        agent = get_agent(target)
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
