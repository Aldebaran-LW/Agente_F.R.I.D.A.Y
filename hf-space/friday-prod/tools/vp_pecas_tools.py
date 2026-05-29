"""Tools VP-Pecas — health sites usinagem."""

import os

import httpx
from smolagents import tool


@tool
def health_site_vp() -> str:
    """Verifica se o site VP-Pecas responde (via gateway ou URL direta)."""
    base = os.environ.get("OPENCLAW_GATEWAY_BASE_URL", "").rstrip("/")
    token = os.environ.get("OPENCLAW_AUTOMATION_TOKEN", "").strip()
    if base and token:
        try:
            r = httpx.get(
                f"{base}/openclaw/deploy/health",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15.0,
            )
            data = r.json()
            site = next((s for s in (data.get("sites") or []) if s.get("site") == "vp-pecas"), None)
            if site:
                return f"VP-Pecas: {'online' if site.get('ok') else 'offline'} — {site.get('url', '')}"
        except Exception as e:
            return f"Erro gateway: {e}"
    url = os.environ.get("VP_PECAS_URL", "https://vp-pecas.vercel.app")
    try:
        r = httpx.get(url, timeout=10.0, follow_redirects=True)
        return f"VP-Pecas HTTP {r.status_code} — {url}"
    except Exception as e:
        return f"VP-Pecas inacessível: {e}"
