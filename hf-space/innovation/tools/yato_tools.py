"""Yato — pesquisa de mercado."""

from __future__ import annotations

import os
from typing import Any

import httpx

from tools.sophia_tools import search_github_trending


def search_product_hunt(topic: str | None = None) -> list[dict[str, Any]]:
    key = os.environ.get("PRODUCT_HUNT_API_KEY", "").strip()
    if not key:
        return [{"note": "PRODUCT_HUNT_API_KEY nao configurada", "topic": topic or ""}]
    # API v2 requer token — estrutura minima
    return [{"note": "Product Hunt: configurar query GraphQL", "topic": topic}]


def search_google_trends(topic: str) -> dict[str, Any]:
    if not os.environ.get("GOOGLE_TRENDS_API_KEY", "").strip():
        return {"ok": False, "simulado": True, "topic": topic, "note": "GOOGLE_TRENDS_API_KEY em falta"}
    return {"ok": True, "topic": topic, "interest": "n/a"}


def search_market(topic: str) -> dict[str, Any]:
    q = f"{topic} stars:>100"
    repos = search_github_trending(q, 10)
    for r in repos:
        r["notas"] = "Proxy mercado: adoção GitHub (>=100 estrelas)"
    return {
        "ok": True,
        "agente": "yato",
        "topico": topic,
        "sinais_mercado": repos,
        "product_hunt": search_product_hunt(topic),
        "google_trends": search_google_trends(topic),
        "dataset_path": "market/",
        "proximo_passo": "senku",
    }
