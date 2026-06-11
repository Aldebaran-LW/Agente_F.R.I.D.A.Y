"""Monitor gateway Vercel + keepalive — migrado do Space openclaw-demo."""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any

import httpx

_last_status: dict[str, Any] | None = None


def _gateway_base() -> str:
    return (os.environ.get("OPENCLAW_GATEWAY_BASE_URL") or "").rstrip("/")


def _gateway_token() -> str:
    return (os.environ.get("OPENCLAW_AUTOMATION_TOKEN") or "").strip()


def _fetch_gateway(path: str) -> dict[str, Any]:
    base = _gateway_base()
    if not base:
        return {"ok": False, "error": "OPENCLAW_GATEWAY_BASE_URL not set"}
    headers = {"Accept": "application/json"}
    token = _gateway_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = httpx.get(f"{base}{path}", headers=headers, timeout=15.0)
        try:
            body = r.json()
        except Exception:
            body = {"raw": (r.text or "")[:200]}
        return {"ok": r.is_success, "status": r.status_code, "body": body}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def build_status() -> dict[str, Any]:
    global _last_status
    now = datetime.now(timezone.utc).isoformat()
    demo = {"ok": True, "service": "friday-prod", "at": now}
    base = _gateway_base()
    health = None
    office = None
    if base:
        health = _fetch_gateway("/api/health")
        if _gateway_token():
            o = _fetch_gateway("/openclaw/office/status")
            office = o.get("body")
    payload: dict[str, Any] = {
        "ok": demo["ok"] and (not base or bool(health and health.get("ok"))),
        "demo": demo,
        "gatewayConfigured": bool(base),
        "gateway": {"base": base, "health": health, "office": office} if base else None,
        "office": office,
        "at": now,
    }
    _last_status = payload
    return payload


def start_keepalive() -> None:
    ms = int(os.environ.get("KEEPALIVE_MS", "240000"))
    if ms <= 0:
        return

    def _loop() -> None:
        while True:
            try:
                st = build_status()
                print(json.dumps({"event": "keepalive", "at": st.get("at")}, ensure_ascii=False))
            except Exception as e:
                print(json.dumps({"event": "keepalive_error", "error": str(e)}, ensure_ascii=False))
            time.sleep(ms / 1000.0)

    threading.Thread(target=_loop, daemon=True, name="friday-keepalive").start()
