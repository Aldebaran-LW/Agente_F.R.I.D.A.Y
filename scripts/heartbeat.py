#!/usr/bin/env python3
"""Heartbeat de infraestrutura OpenClaw."""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
WORKSPACE = SCRIPT_DIR.parent
DEFAULT_ENV = WORKSPACE / ".env"
DEFAULT_STATE = WORKSPACE / ".heartbeat-state.json"
TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = value.strip().strip('"').strip("'")


def env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


def check_gateway_service() -> CheckResult:
    if platform.system() != "Linux" or not shutil.which("systemctl"):
        return CheckResult("gateway_service", True, "ignorado (nao-Linux)")
    try:
        proc = subprocess.run(
            ["systemctl", "is-active", "openclaw-gateway"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        active = proc.stdout.strip() == "active"
        detail = proc.stdout.strip() or proc.stderr.strip() or "sem resposta"
        return CheckResult("gateway_service", active, detail)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return CheckResult("gateway_service", False, f"erro systemctl: {exc}")


def check_gateway_http() -> CheckResult:
    port = os.environ.get("OPENCLAW_GATEWAY_PORT", "18789").strip() or "18789"
    url = os.environ.get("HEARTBEAT_GATEWAY_URL", f"http://127.0.0.1:{port}/").strip()
    timeout = env_int("HEARTBEAT_HTTP_TIMEOUT_SEC", 10)
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return CheckResult("gateway_http", True, f"HTTP {resp.status} {url}")
    except urllib.error.HTTPError as exc:
        return CheckResult("gateway_http", True, f"HTTP {exc.code} {url}")
    except Exception as exc:
        return CheckResult("gateway_http", False, f"{url} - {exc}")


def check_telegram() -> CheckResult:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        return CheckResult("telegram", False, "TELEGRAM_BOT_TOKEN ausente")
    url = TELEGRAM_API.format(token=token, method="getMe")
    timeout = env_int("HEARTBEAT_HTTP_TIMEOUT_SEC", 10)
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if not data.get("ok"):
            return CheckResult("telegram", False, "getMe ok=false")
        user = data.get("result", {}).get("username", "?")
        return CheckResult("telegram", True, f"@{user}")
    except Exception as exc:
        return CheckResult("telegram", False, str(exc))


def check_mongodb() -> CheckResult:
    if not env_bool("HEARTBEAT_CHECK_MONGODB", True):
        return CheckResult("mongodb", True, "desativado")
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        return CheckResult("mongodb", True, "MONGODB_URI ausente (ignorado)")
    script = SCRIPT_DIR / "macofel-count-pending.js"
    if not script.is_file():
        return CheckResult("mongodb", False, "macofel-count-pending.js nao encontrado")
    node = shutil.which("node") or "node"
    try:
        proc = subprocess.run(
            [node, str(script)],
            cwd=str(SCRIPT_DIR),
            capture_output=True,
            text=True,
            timeout=env_int("HEARTBEAT_MONGODB_TIMEOUT_SEC", 30),
            check=False,
            env=os.environ.copy(),
        )
        out = (proc.stdout or proc.stderr or "").strip()
        if proc.returncode != 0:
            return CheckResult("mongodb", False, out[:200] or f"exit {proc.returncode}")
        payload = json.loads(out.splitlines()[-1])
        if payload.get("ok"):
            return CheckResult("mongodb", True, f"db={payload.get('db', '?')}")
        return CheckResult("mongodb", False, payload.get("error", "falha"))
    except subprocess.TimeoutExpired:
        return CheckResult("mongodb", False, "timeout")
    except (json.JSONDecodeError, OSError) as exc:
        return CheckResult("mongodb", False, str(exc))


def check_host_resources() -> CheckResult:
    if platform.system() != "Linux":
        return CheckResult("host_resources", True, "ignorado (nao-Linux)")
    min_ram_mb = env_int("HEARTBEAT_MIN_FREE_RAM_MB", 256)
    min_disk_pct = env_int("HEARTBEAT_MIN_FREE_DISK_PCT", 10)
    issues: list[str] = []
    if platform.system() == "Linux":
        try:
            for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
                if line.startswith("MemAvailable:"):
                    avail_mb = int(re.findall(r"\d+", line)[0]) // 1024
                    if avail_mb < min_ram_mb:
                        issues.append(f"RAM livre {avail_mb}MB < {min_ram_mb}MB")
                    break
        except OSError as exc:
            issues.append(f"RAM: {exc}")
    try:
        usage = shutil.disk_usage(str(WORKSPACE))
        free_pct = (usage.free / usage.total) * 100 if usage.total else 0
        if free_pct < min_disk_pct:
            issues.append(f"disco livre {free_pct:.1f}% < {min_disk_pct}%")
    except OSError as exc:
        issues.append(f"disco: {exc}")
    if issues:
        return CheckResult("host_resources", False, "; ".join(issues))
    return CheckResult("host_resources", True, "RAM/disco OK")


def check_heimdall_flow() -> tuple[CheckResult, dict[str, str], list[str]]:
    """Executa heimdall-flow-monitor.mjs; devolve estados por agente e alertas de transição."""
    if not env_bool("HEARTBEAT_CHECK_HEIMDALL_FLOW", True):
        return CheckResult("heimdall_flow", True, "desativado"), {}, []
    script = SCRIPT_DIR / "heimdall-flow-monitor.mjs"
    if not script.is_file():
        return CheckResult("heimdall_flow", False, "heimdall-flow-monitor.mjs ausente"), {}, []
    node = shutil.which("node") or "node"
    try:
        proc = subprocess.run(
            [node, str(script), "--json"],
            cwd=str(WORKSPACE),
            capture_output=True,
            text=True,
            timeout=env_int("HEARTBEAT_HEIMDALL_TIMEOUT_SEC", 90),
            check=False,
            env=os.environ.copy(),
        )
        raw = (proc.stdout or "").strip()
        if not raw:
            return CheckResult(
                "heimdall_flow",
                False,
                (proc.stderr or "sem stdout")[:200],
            ), {}, []
        flow = json.loads(raw)
        activity: dict[str, str] = flow.get("agent_activity") or {}
        detail = (
            f"ok={flow.get('ok')} erros={flow.get('error_count', 0)} "
            f"ativos={flow.get('working_count', 0)}"
        )
        ok = bool(flow.get("ok"))
        transition_msgs: list[str] = []
        return CheckResult("heimdall_flow", ok, detail), activity, transition_msgs
    except subprocess.TimeoutExpired:
        return CheckResult("heimdall_flow", False, "timeout"), {}, []
    except (json.JSONDecodeError, OSError) as exc:
        return CheckResult("heimdall_flow", False, str(exc)[:200]), {}, []


def agent_transition_alerts(
    prev_agents: dict[str, str],
    new_agents: dict[str, str],
) -> list[str]:
    """Alerta só em transições (evita spam de 'working')."""
    msgs: list[str] = []
    for agent_id, status in new_agents.items():
        prev = prev_agents.get(agent_id)
        if prev is None:
            continue
        if prev in ("error", "stale", "fail") and status in ("idle", "working"):
            msgs.append(f"[RECUPERADO] Agente {agent_id} — estado {status}.")
        elif prev in ("working", "idle") and status == "stale":
            msgs.append(f"[AVISO] Agente {agent_id} sem atividade Hub (stale).")
        elif prev != "error" and status == "error":
            msgs.append(f"[CRITICO] Agente {agent_id} em erro de contexto/fluxo.")
    return msgs


def run_checks() -> tuple[list[CheckResult], dict[str, str], list[str]]:
    results: list[CheckResult] = []
    agent_states: dict[str, str] = {}
    extra_alerts: list[str] = []
    if env_bool("HEARTBEAT_CHECK_GATEWAY", True):
        results.append(check_gateway_service())
        results.append(check_gateway_http())
    else:
        results.append(CheckResult("gateway_service", True, "desativado"))
        results.append(CheckResult("gateway_http", True, "desativado"))
    results.append(check_telegram())
    results.append(check_mongodb())
    results.append(check_host_resources())
    flow_check, agent_states, _ = check_heimdall_flow()
    results.append(flow_check)
    return results, agent_states, extra_alerts


def load_state(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def cooldown_ok_transition(state: dict[str, Any], cooldown_sec: int) -> bool:
    last = state.get("last_agent_alert_at") or state.get("last_alert_at")
    if not last:
        return True
    try:
        last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - last_dt).total_seconds() >= cooldown_sec
    except ValueError:
        return True


def should_alert(results: list[CheckResult], state: dict[str, Any], cooldown_sec: int) -> tuple[bool, bool]:
    now = datetime.now(timezone.utc)
    prev_checks: dict[str, str] = state.get("checks", {})
    current = {r.name: ("ok" if r.ok else "fail") for r in results}
    failures = [r for r in results if not r.ok]
    all_ok = not failures
    had_failure = any(v == "fail" for v in prev_checks.values())
    state_changed = current != prev_checks
    cooldown_ok = True
    last_alert = state.get("last_alert_at")
    if last_alert:
        try:
            last_dt = datetime.fromisoformat(last_alert.replace("Z", "+00:00"))
            cooldown_ok = (now - last_dt).total_seconds() >= cooldown_sec
        except ValueError:
            cooldown_ok = True
    if failures and (state_changed or cooldown_ok):
        return True, False
    if all_ok and had_failure:
        return False, True
    return False, False


def format_message(results: list[CheckResult], recovered: bool) -> str:
    if recovered:
        lines = ["[RECUPERADO] OpenClaw heartbeat - todos os checks OK."]
    else:
        lines = ["[CRITICO] Falha no OpenClaw heartbeat:"]
    for r in results:
        if recovered or not r.ok:
            icon = "OK" if r.ok else "FALHA"
            lines.append(f"  - {r.name}: {icon} - {r.detail}")
    lines.append(f"  - quando: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    return "\n".join(lines)


def dispatch_scheduled_whatsapp(dry_run: bool) -> None:
    if not env_bool("SCHEDULED_WHATSAPP_ENABLED", True):
        return
    script = WORKSPACE / "scripts" / "scheduled-whatsapp-dispatch.mjs"
    if not script.is_file():
        return
    node = shutil.which("node")
    if not node:
        print("AVISO: node ausente — lembretes WhatsApp nao enviados", file=sys.stderr)
        return
    cmd = [node, str(script)]
    if dry_run:
        cmd.append("--dry-run")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=False)
        if proc.stdout.strip():
            print(proc.stdout.strip())
        if proc.returncode != 0 and proc.stderr.strip():
            print(f"AVISO WhatsApp dispatch: {proc.stderr.strip()}", file=sys.stderr)
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"AVISO WhatsApp dispatch: {exc}", file=sys.stderr)


def send_telegram(text: str, dry_run: bool) -> bool:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
    if not token:
        print("AVISO: TELEGRAM_BOT_TOKEN ausente", file=sys.stderr)
        return False
    if not chat_id:
        print("AVISO: TELEGRAM_ADMIN_CHAT_ID ausente", file=sys.stderr)
        return False
    if dry_run:
        print("--- DRY RUN (Telegram) ---")
        print(text)
        return True
    url = TELEGRAM_API.format(token=token, method="sendMessage")
    body = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return bool(data.get("ok"))
    except Exception as exc:
        print(f"ERRO Telegram: {exc}", file=sys.stderr)
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Heartbeat OpenClaw")
    parser.add_argument("--env", default=os.environ.get("OPENCLAW_ENV", str(DEFAULT_ENV)))
    parser.add_argument("--state", default=os.environ.get("HEARTBEAT_STATE_FILE", str(DEFAULT_STATE)))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    load_env(Path(args.env))
    dry_run = env_bool("HEARTBEAT_DRY_RUN", False) or args.dry_run
    cooldown = env_int("HEARTBEAT_ALERT_COOLDOWN_SEC", 3600)
    results, agent_states, _ = run_checks()
    state = load_state(Path(args.state))
    prev_agents: dict[str, str] = state.get("agents", {})
    transition_msgs = agent_transition_alerts(prev_agents, agent_states)
    alert_fail, alert_recover = should_alert(results, state, cooldown)
    all_ok = all(r.ok for r in results)
    print(json.dumps({"ok": all_ok, "checks": {r.name: r.detail for r in results}}, ensure_ascii=False))
    new_state: dict[str, Any] = {
        "checks": {r.name: ("ok" if r.ok else "fail") for r in results},
        "agents": agent_states,
        "last_run_at": datetime.now(timezone.utc).isoformat(),
    }
    if alert_fail:
        if send_telegram(format_message(results, False), dry_run):
            new_state["last_alert_at"] = datetime.now(timezone.utc).isoformat()
    elif alert_recover:
        send_telegram(format_message(results, True), dry_run)
    elif transition_msgs and cooldown_ok_transition(state, cooldown):
        text = "[Heimdall fluxo]\n" + "\n".join(transition_msgs)
        if send_telegram(text, dry_run):
            new_state["last_agent_alert_at"] = datetime.now(timezone.utc).isoformat()
    save_state(Path(args.state), {**state, **new_state})
    dispatch_scheduled_whatsapp(dry_run)
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())