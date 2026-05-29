#!/usr/bin/env python3
"""
Atualiza estado visual de um agente para dashboards (Star Office UI, scripts locais).

Uso:
  python3 set_state.py idle "Pronto para o próximo"
  python3 set_state.py writing "A revisar catálogo" --agent macofel
  python3 set_state.py executing "Deploy VP-Pecas" -a ops

Variáveis:
  OPENCLAW_AGENT_STATE_FILE  — JSON multi-agente (default ~/.openclaw/workspace/agent_states.json)
  OPENCLAW_STAR_OFFICE_DIR   — se definido, delega ao set_state.py do Star Office UI
  OPENCLAW_AGENT_ID          — agente por omissão (default: main)
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

VALID_STATES = frozenset(
    {
        "idle",
        "writing",
        "researching",
        "executing",
        "syncing",
        "error",
        # aliases usados no painel Vercel / docs internos
        "thinking",
        "working",
        "compiling",
    }
)

FORGE_ALIAS = {
    "orchestrator": "friday",
    "sophia": "sophia",
    "rebeca": "rebeca",
    "senku": "senku",
    "hefestos": "hefestos",
    "icaro": "icaro",
    "athena": "athena",
    "dedalo": "dedalo",
    "ops": "byte",
    "vp-pecas": "pixel",
    "macofel": "lala",
    "main": "friday",
}


def default_state_file() -> Path:
    raw = os.environ.get("OPENCLAW_AGENT_STATE_FILE")
    if raw:
        return Path(raw).expanduser()
    return Path.home() / ".openclaw" / "workspace" / "agent_states.json"


def push_digital_forge(agent_id: str, state: str, message: str) -> None:
    """HTTP POST para o middleware Digital Forge (se OPENCLAW_FORGE_PUSH_URL definido)."""
    import urllib.error
    import urllib.request

    base = os.environ.get("OPENCLAW_FORGE_PUSH_URL", "").rstrip("/")
    if not base:
        return
    forge_agent = FORGE_ALIAS.get(agent_id.lower(), agent_id.lower())
    payload = json.dumps(
        {"agent": forge_agent, "state": state, "task": message},
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/push",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            res.read()
        print(f"   forge → {forge_agent} ({base})")
    except (urllib.error.URLError, OSError) as e:
        print(f"   forge (skip): {e}", file=sys.stderr)


def delegate_star_office(state: str, message: str) -> int:
    root = Path(os.environ["OPENCLAW_STAR_OFFICE_DIR"]).expanduser()
    script = root / "set_state.py"
    if not script.is_file():
        print(f"Star Office: set_state.py não encontrado em {root}", file=sys.stderr)
        return 1
    cmd = [sys.executable, str(script), state]
    if message:
        cmd.append(message)
    return subprocess.call(cmd, cwd=str(root))


def load_db(path: Path) -> dict:
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"version": 1, "agents": {}, "updatedAt": None}


def save_db(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data["updatedAt"] = time.time()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    # compat: alguns dashboards leem só o agente "main"
    legacy = path.parent / "agent_state.json"
    main = data.get("agents", {}).get("main") or data.get("agents", {}).get(
        os.environ.get("OPENCLAW_AGENT_ID", "main")
    )
    if main:
        legacy.write_text(
            json.dumps(
                {
                    "state": main["state"],
                    "message": main.get("message", ""),
                    "timestamp": main.get("timestamp", time.time()),
                    "agent": main.get("id", "main"),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Sincronizar estado visual do agente")
    parser.add_argument("state", nargs="?", default="idle", help="idle|writing|researching|...")
    parser.add_argument("message", nargs="?", default="", help="Descrição curta (sem PII)")
    parser.add_argument(
        "--agent",
        "-a",
        default=os.environ.get("OPENCLAW_AGENT_ID", "main"),
        help="ID do agente (orchestrator, macofel, vp-pecas, ops, main)",
    )
    args = parser.parse_args()

    state = args.state.strip().lower()
    if state not in VALID_STATES:
        print(f"Estado inválido: {state}. Válidos: {', '.join(sorted(VALID_STATES))}", file=sys.stderr)
        return 1

    message = (args.message or "").strip()
    if len(message) > 240:
        message = message[:237] + "..."

    if os.environ.get("OPENCLAW_STAR_OFFICE_DIR"):
        return delegate_star_office(state, message)

    path = default_state_file()
    db = load_db(path)
    agents = db.setdefault("agents", {})
    agents[args.agent] = {
        "id": args.agent,
        "state": state,
        "message": message,
        "timestamp": time.time(),
    }
    save_db(path, db)
    push_digital_forge(args.agent, state, message)
    print(f"OK {args.agent} -> {state}: {message or '(sem mensagem)'}")
    print(f"   {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
