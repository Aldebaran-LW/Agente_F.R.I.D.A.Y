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


def append_learning(agent: str, text: str, source: str = "friday-prod") -> dict:
    token = os.environ.get("HF_TOKEN", "").strip()
    dataset = os.environ.get("HF_BACKUP_DATASET", "Aldebaran-LW/openclaw-backup")
    if not token:
        return {"ok": False, "error": "HF_TOKEN not set"}

    entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "agent": agent,
        "source": source,
        "text": text[:4000],
    }
    day = entry["at"][:10]
    path = f"learnings/{agent}/{day}.jsonl"
    line = json.dumps(entry, ensure_ascii=False) + "\n"
    b64 = base64.b64encode(line.encode("utf-8")).decode("ascii")

    url = f"https://huggingface.co/api/datasets/{dataset}/commit/main"
    payload = {
        "summary": f"learning {agent} {entry['at']}",
        "operations": [{"operation": "addOrUpdate", "path": path, "content": b64}],
    }
    r = httpx.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=60.0,
        json=payload,
    )
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text[:500]}
    return {"ok": r.is_success, "status": r.status_code, "body": body}
