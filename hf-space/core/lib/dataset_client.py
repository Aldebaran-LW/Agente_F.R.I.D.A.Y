"""Leitura/escrita no Dataset HF openclaw-backup."""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from typing import Any

import httpx


def _dataset() -> str:
    return os.environ.get("HF_BACKUP_DATASET", "Aldebaran-LW/openclaw-backup")


def _token() -> str:
    return os.environ.get("HF_TOKEN", "").strip()


def _commit_file(path: str, payload: dict | str, summary: str) -> dict:
    token = _token()
    if not token:
        return {"ok": False, "error": "HF_TOKEN not set"}

    if isinstance(payload, dict):
        content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    else:
        content = str(payload)
    b64 = base64.b64encode(content.encode("utf-8")).decode("ascii")
    ndjson = "\n".join(
        [
            json.dumps({"key": "header", "value": {"summary": summary, "description": ""}}),
            json.dumps({"key": "file", "value": {"path": path, "content": b64, "encoding": "base64"}}),
        ]
    )
    url = f"https://huggingface.co/api/datasets/{_dataset()}/commit/main"
    r = httpx.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/x-ndjson"},
        content=ndjson.encode("utf-8"),
        timeout=60.0,
    )
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text[:300]}
    return {"ok": r.is_success, "status": r.status_code, "path": path, "body": body}


def save_discovery(agent: str, topic: str, result: dict) -> dict:
    """agent: sophia|yato → knowledge/ | market/"""
    folder = {"sophia": "knowledge", "yato": "market"}.get(agent, f"discoveries/{agent}")
    at = datetime.now(timezone.utc)
    safe = at.isoformat().replace(":", "-").replace(".", "-")
    slug = "".join(c if c.isalnum() else "_" for c in topic.lower())[:40]
    path = f"{folder}/{at.date().isoformat()}/{agent}_{slug}_{safe}.json"
    doc = {
        "at": at.isoformat(),
        "agent": agent,
        "topic": topic,
        "source": "friday-prod",
        "result": result,
    }
    return _commit_file(path, doc, f"discovery {agent} {topic[:40]}")


def save_analysis(analysis: dict) -> dict:
    at = datetime.now(timezone.utc)
    safe = at.isoformat().replace(":", "-").replace(".", "-")
    path = f"analysis/{at.date().isoformat()}/senku_{safe}.json"
    return _commit_file(path, analysis, "senku analysis")


def save_prediction(prediction: dict) -> dict:
    at = datetime.now(timezone.utc)
    safe = at.isoformat().replace(":", "-").replace(".", "-")
    path = f"predictions/{at.date().isoformat()}/gideon_{safe}.json"
    return _commit_file(path, prediction, "gideon prediction")


def load_discoveries(agent: str, days: int = 7) -> dict:
    """Lista via API do Dataset (best-effort; pode estar vazio sem listagem)."""
    token = _token()
    if not token:
        return {"ok": False, "error": "HF_TOKEN not set", "items": []}
    folder = {"sophia": "knowledge", "yato": "market"}.get(agent, agent)
    # HF datasets API list — simplificado
    return {"ok": True, "agent": agent, "folder": folder, "days": days, "items": [], "note": "use resultado em memoria no mesmo /run/pipeline"}
