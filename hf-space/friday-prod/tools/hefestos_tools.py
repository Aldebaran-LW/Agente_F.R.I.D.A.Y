"""Hefestos — proposta de construção (HF Space). Não escreve no repo sem aprovação."""

from __future__ import annotations

import os
from typing import Any


THRESHOLD = int(os.environ.get("GIDEON_THRESHOLD", "70"))


def build_from_prediction(prediction: dict, topic: str | None = None) -> dict[str, Any]:
    score = prediction.get("confianca_score") or prediction.get("viabilidade_score") or 0
    rec = prediction.get("recomendacao", "arquivar")
    topico = topic or prediction.get("topico") or "openclaw"
    slug = "".join(c if c.isalnum() else "-" for c in topico.lower()).strip("-")[:40]
    return {
        "ok": score >= THRESHOLD and rec == "hefestos",
        "agente": "hefestos",
        "topico": topico,
        "gideon_score": score,
        "recomendacao": rec,
        "proposta": {
            "tipo": "skill",
            "paths": [f"skills/{slug}/SKILL.md"],
        },
        "mensagem": (
            f"Proposta skill `{slug}` (score {score}). "
            "Aplicar no repo só após sim/confirmar no Telegram (EC2: hefestos-build --apply)."
        ),
        "requires_human_approval": True,
    }


def run_hefestos(task: str, context: dict | None = None) -> dict[str, Any]:
    ctx = context or {}
    pred = ctx.get("gideon") or ctx.get("prediction") or {}
    if not pred and ctx.get("senku"):
        from tools.gideon_tools import predict

        pred = predict(topic=task, senku=ctx.get("senku"))
    return build_from_prediction(pred, topic=task)
