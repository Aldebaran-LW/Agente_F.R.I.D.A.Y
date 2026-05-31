"""
Backup de interações para Dataset HF (openclaw-backup).
Chamado após /run ou via cron no Space.
"""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone

import httpx


def append_learning(
    agent: str,
    text: str,
    source: str = "friday-prod",
    mode: str | None = None,
) -> dict:
    token = os.environ.get("HF_TOKEN", "").strip()
    dataset = os.environ.get("HF_BACKUP_DATASET", "Aldebaran-LW/openclaw-backup")
    if not token:
        return {"ok": False, "error": "HF_TOKEN not set"}

    at = datetime.now(timezone.utc).isoformat()
    entry = {
        "at": at,
        "agent": agent,
        "source": source,
        "mode": mode,
        "text": text[:4000],
    }
    day = at[:10]
    # Um ficheiro por entrada — addOrUpdate substitui o path inteiro no Hub.
    safe_ts = at.replace(":", "-").replace(".", "-")
    path = f"learnings/{agent}/{day}/{safe_ts}.jsonl"
    line = json.dumps(entry, ensure_ascii=False) + "\n"
    b64 = base64.b64encode(line.encode("utf-8")).decode("ascii")

    url = f"https://huggingface.co/api/datasets/{dataset}/commit/main"
    ndjson = "\n".join(
        [
            json.dumps({"key": "header", "value": {"summary": f"learning {agent} {at}", "description": ""}}),
            json.dumps(
                {
                    "key": "file",
                    "value": {"path": path, "content": b64, "encoding": "base64"},
                }
            ),
        ]
    )
    r = httpx.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/x-ndjson"},
        content=ndjson.encode("utf-8"),
        timeout=60.0,
    )
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text[:500]}
    return {"ok": r.is_success, "status": r.status_code, "body": body}
