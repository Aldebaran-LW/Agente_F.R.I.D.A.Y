"""Execução determinística Sophia → Yato → Senku → Gideon."""

from __future__ import annotations

from typing import Any

from lib.dataset_client import save_analysis, save_discovery, save_prediction
from tools.gideon_tools import predict, recommend_for_hefestos
from tools.senku_tools import analyze
from tools.sophia_tools import search_knowledge
from tools.yato_tools import search_market
from tools.hefestos_tools import run_hefestos


def extract_topic(task: str, context: dict | None = None) -> str:
    if context and context.get("topic"):
        return str(context["topic"]).strip()[:200]
    t = task.strip()
    for prefix in ("topico:", "tópico:", "topic:"):
        if t.lower().startswith(prefix):
            return t.split(":", 1)[1].strip()[:200]
    return t[:200] or "openclaw"


def run_sophia(topic: str, persist: bool = True) -> dict[str, Any]:
    result = search_knowledge(topic)
    ds = save_discovery("sophia", topic, result) if persist else {"ok": False, "skipped": True}
    return {"ok": True, "mode": "innovation-sophia", "agent_id": "sophia", "topic": topic, "result": result, "dataset": ds}


def run_yato(topic: str, persist: bool = True) -> dict[str, Any]:
    result = search_market(topic)
    ds = save_discovery("yato", topic, result) if persist else {"ok": False, "skipped": True}
    return {"ok": True, "mode": "innovation-yato", "agent_id": "yato", "topic": topic, "result": result, "dataset": ds}


def run_senku(topic: str, sophia: dict | None = None, yato: dict | None = None, persist: bool = True) -> dict[str, Any]:
    if sophia is None:
        sophia = search_knowledge(topic)
    if yato is None:
        yato = search_market(topic)
    analysis = analyze(topic, sophia=sophia, yato=yato)
    ds = save_analysis(analysis) if persist else {"ok": False, "skipped": True}
    return {"ok": True, "mode": "innovation-senku", "agent_id": "senku", "topic": topic, "result": analysis, "dataset": ds}


def run_gideon(topic: str, senku: dict | None = None, persist: bool = True) -> dict[str, Any]:
    prediction = predict(topic, senku=senku)
    rec = recommend_for_hefestos(prediction)
    ds = save_prediction({**prediction, "hefestos": rec}) if persist else {"ok": False, "skipped": True}
    return {
        "ok": True,
        "mode": "innovation-gideon",
        "agent_id": "gideon",
        "topic": topic,
        "result": prediction,
        "hefestos": rec,
        "dataset": ds,
    }


def run_pipeline(topic: str, persist: bool = True) -> dict[str, Any]:
    s = run_sophia(topic, persist=persist)
    y = run_yato(topic, persist=persist)
    sk = run_senku(topic, sophia=s["result"], yato=y["result"], persist=persist)
    g = run_gideon(topic, senku=sk["result"], persist=persist)
    return {
        "ok": True,
        "mode": "innovation-pipeline",
        "topic": topic,
        "sophia": s,
        "yato": y,
        "senku": sk,
        "gideon": g,
        "telegram_hint": _telegram_summary(g),
    }


def _telegram_summary(gideon_out: dict) -> str:
    pred = gideon_out.get("result") or {}
    score = pred.get("confianca_score", "?")
    rec = pred.get("recomendacao", "?")
    return f"Gideon: confianca {score}/100 -> {rec}"


def run_hefestos_agent(topic: str, ctx: dict | None = None) -> dict[str, Any]:
    out = run_hefestos(topic, ctx)
    return {
        "ok": True,
        "mode": "innovation-hefestos",
        "agent_id": "hefestos",
        "topic": topic,
        "result": out,
    }


INNOVATION_HANDLERS = {
    "sophia": lambda topic, **_: run_sophia(topic),
    "yato": lambda topic, **_: run_yato(topic),
    "senku": lambda topic, ctx: run_senku(
        topic,
        sophia=(ctx or {}).get("sophia"),
        yato=(ctx or {}).get("yato"),
    ),
    "gideon": lambda topic, ctx: run_gideon(topic, senku=(ctx or {}).get("senku")),
    "hefestos": lambda topic, ctx: run_hefestos_agent(topic, ctx),
    "pipeline": lambda topic, **_: run_pipeline(topic),
}
