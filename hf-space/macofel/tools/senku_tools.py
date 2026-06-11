"""Senku — correlação conhecimento + mercado."""

from __future__ import annotations

import re
from typing import Any


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def _items_knowledge(data: dict) -> list[dict]:
    out = []
    for s in data.get("hf_spaces") or []:
        out.append({"nome": s.get("id"), "link": s.get("link"), "metrica": s.get("likes", 0), "fonte": "conhecimento"})
    for r in data.get("github_repos") or []:
        out.append({"nome": r.get("nome"), "link": r.get("link"), "metrica": r.get("stars", 0), "fonte": "conhecimento"})
    return out


def _items_market(data: dict) -> list[dict]:
    return [
        {
            "nome": r.get("nome"),
            "link": r.get("link"),
            "metrica": r.get("stars", 0),
            "fonte": "mercado",
        }
        for r in data.get("sinais_mercado") or []
    ]


def correlate(knowledge: list[dict], market: list[dict], topic: str) -> dict[str, Any]:
    correlacoes = []
    vistos: set[str] = set()
    for k in knowledge:
        kn = _norm(k.get("nome"))
        for m in market:
            mn = _norm(m.get("nome"))
            if not kn or not mn:
                continue
            if kn in mn or mn in kn or kn[:8] == mn[:8]:
                key = f"{kn}|{mn}"
                if key in vistos:
                    continue
                vistos.add(key)
                correlacoes.append(
                    {
                        "nome": k.get("nome"),
                        "insight": "Alinhamento conhecimento + tração de mercado",
                        "forca": min(100, int((k.get("metrica", 0) + m.get("metrica", 0)) / 20)),
                    }
                )

    solicitacoes = []
    if not knowledge:
        solicitacoes.append({"agente": "sophia", "pedido": f"Pesquisar conhecimento: {topic}"})
    if not market:
        solicitacoes.append({"agente": "yato", "pedido": f"Pesquisar mercado: {topic}"})
    if knowledge and market and not correlacoes:
        solicitacoes.append({"agente": "yato", "pedido": f"Aprofundar concorrentes: {topic}"})

    forca_media = (
        round(sum(c["forca"] for c in correlacoes) / len(correlacoes))
        if correlacoes
        else (40 if knowledge or market else 0)
    )

    return {
        "topico": topic,
        "correlacoes": correlacoes,
        "solicitacoes_pesquisa": solicitacoes,
        "resumo": {
            "itens_conhecimento": len(knowledge),
            "itens_mercado": len(market),
            "correlacoes_fortes": sum(1 for c in correlacoes if c["forca"] >= 50),
            "forca_media": forca_media,
        },
        "proximo_passo": "gideon",
    }


def load_recent_discoveries(days: int = 7) -> dict:
    return {"ok": True, "days": days, "note": "usar payload do pipeline na mesma sessao"}


def request_new_research(gap: str, agent: str) -> dict:
    return {"ok": True, "agent": agent, "gap": gap, "action": "pedido_pesquisa"}


def analyze(topic: str | None = None, sophia: dict | None = None, yato: dict | None = None) -> dict:
    topic = topic or (sophia or {}).get("topico") or (yato or {}).get("topico") or "openclaw"
    knowledge = _items_knowledge(sophia or {})
    market = _items_market(yato or {})
    body = correlate(knowledge, market, topic)
    body["agente"] = "senku"
    body["dataset_path"] = "analysis/"
    return {"ok": True, **body}
