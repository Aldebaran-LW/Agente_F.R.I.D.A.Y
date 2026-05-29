"""Tools Ops — GitHub e deploy via gateway."""

import os

import httpx
from smolagents import tool


def _gateway_get(path: str) -> dict | None:
    base = os.environ.get("OPENCLAW_GATEWAY_BASE_URL", "").rstrip("/")
    token = os.environ.get("OPENCLAW_AUTOMATION_TOKEN", "").strip()
    if not base or not token:
        return None
    try:
        r = httpx.get(
            f"{base}{path}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=15.0,
        )
        return r.json() if r.is_success else {"error": r.status_code}
    except Exception as e:
        return {"error": str(e)}


@tool
def status_github() -> str:
    """Resumo dos repositórios Aldebaran-LW no GitHub."""
    data = _gateway_get("/openclaw/github/status")
    if not data:
        return "[stub] Configure OPENCLAW_GATEWAY_BASE_URL e OPENCLAW_AUTOMATION_TOKEN no Space."
    if not data.get("ok"):
        return f"GitHub indisponível: {data.get('error', data)}"
    repos = data.get("repos") or []
    lines = [f"{r.get('name')}: {r.get('open_issues', 0)} issues" for r in repos[:5]]
    return "GitHub OK\n" + "\n".join(lines) if lines else "GitHub OK (sem repos)"


@tool
def status_deploy() -> str:
    """Estado dos sites no ar (health-check deploy)."""
    data = _gateway_get("/openclaw/deploy/health")
    if not data:
        return "[stub] Gateway não configurado."
    sites = (data.get("sites") or data.get("body", {}).get("sites") or [])[:6]
    if not sites:
        return f"Deploy: {data}"
    return "\n".join(
        f"{s.get('site', '?')}: {'OK' if s.get('ok') else 'FALHA'} ({s.get('ms', '?')}ms)"
        for s in sites
    )
