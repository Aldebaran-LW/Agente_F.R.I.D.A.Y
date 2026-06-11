"""Gideon — predição e cenários."""

from __future__ import annotations

import os
from typing import Any


def load_analysis() -> dict:
    return {"ok": True, "note": "passar analise Senku no mesmo request pipeline"}


def load_history() -> list:
    return []


def calculate_confidence(score: float) -> int:
    return max(0, min(100, int(round(score))))


THRESHOLD = int(os.environ.get("GIDEON_THRESHOLD", "70"))


def predict(topic: str | None = None, senku: dict | None = None) -> dict:
    s = senku or {}
    correlacoes = s.get("correlacoes") or []
    resumo = s.get("resumo") or {}
    solicitacoes = s.get("solicitacoes_pesquisa") or []
    topico = topic or s.get("topico") or "openclaw"
    forca = resumo.get("forca_media", 0)
    n_corr = len(correlacoes)
    gaps = len(solicitacoes)

    confianca = calculate_confidence(
        forca * 0.5 + n_corr * 8 - gaps * 12
        + (10 if resumo.get("itens_conhecimento", 0) > 0 else 0)
        + (10 if resumo.get("itens_mercado", 0) > 0 else 0)
    )

    cenarios = [
        {
            "nome": "provavel",
            "horizonte_meses": 6,
            "descricao": (
                f"Adoção gradual de {topico}; {n_corr} sinal(is) alinhados."
                if n_corr
                else "Dados insuficientes — mais pesquisa."
            ),
        },
        {"nome": "melhor", "horizonte_meses": 3, "descricao": "Skill OpenClaw + ganho no Hub."},
        {"nome": "pior", "horizonte_meses": 12, "descricao": "Concorrente consolida antes da implementação."},
    ]

    if gaps >= 2:
        recomendacao = "mais_pesquisa"
    elif confianca >= THRESHOLD:
        recomendacao = "hefestos"
    elif confianca >= 45:
        recomendacao = "mais_pesquisa"
    else:
        recomendacao = "arquivar"

    return {
        "ok": True,
        "agente": "gideon",
        "topico": topico,
        "cenarios": cenarios,
        "confianca_score": confianca,
        "viabilidade_score": confianca,
        "recomendacao": recomendacao,
        "threshold": THRESHOLD,
        "dataset_path": "predictions/",
        "justificativa": (
            f"Lacunas ({gaps}); reforçar Sophia/Yato."
            if gaps
            else (
                "Elegível para Hefestos (aprovação humana obrigatória)."
                if confianca >= THRESHOLD
                else "Confiança abaixo do limiar."
            )
        ),
    }


def recommend_for_hefestos(prediction: dict) -> dict:
    rec = prediction.get("recomendacao")
    return {
        "ok": True,
        "hefestos": rec == "hefestos",
        "requires_human_approval": rec == "hefestos",
        "message": (
            "Encaminhar para Hefestos após sim/confirmar no Telegram."
            if rec == "hefestos"
            else f"Sem construção automática ({rec})."
        ),
    }
