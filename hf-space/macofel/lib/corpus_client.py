"""Leitura do corpus/ no Dataset HF (RAG leve por keyword)."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx


def _dataset() -> str:
    return (
        os.environ.get("HF_CORPUS_DATASET", "").strip()
        or os.environ.get("HF_BACKUP_DATASET", "Aldebaran-LW/openclaw-backup")
    )


def _token() -> str:
    return os.environ.get("HF_TOKEN", "").strip()


def _list_corpus_paths() -> list[str]:
    """Lista paths corpus/*.jsonl via API datasets (best-effort)."""
    token = _token()
    dataset = _dataset()
    if not token:
        return []
    url = f"https://huggingface.co/api/datasets/{dataset}/tree/main/corpus"
    try:
        r = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=20.0, follow_redirects=True)
        if r.status_code >= 400:
            return []
        data = r.json()
    except Exception:
        return []

    paths: list[str] = []

    def walk(nodes: list, prefix: str = "corpus") -> None:
        for node in nodes or []:
            if not isinstance(node, dict):
                continue
            p = node.get("path") or ""
            if node.get("type") == "file" and p.endswith(".jsonl"):
                paths.append(p)
            elif node.get("type") == "directory":
                sub = f"{prefix}/{node.get('path', '').split('/')[-1]}" if prefix else node.get("path", "")
                # tree API returns flat siblings; skip deep walk if no children
                pass

    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get("type") == "file" and str(item.get("path", "")).endswith(".jsonl"):
                paths.append(item["path"])
    return paths


def _fetch_jsonl(path: str) -> list[dict[str, Any]]:
    token = _token()
    dataset = _dataset()
    if not token:
        return []
    url = f"https://huggingface.co/api/datasets/{dataset}/resolve/main/{path}"
    try:
        r = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30.0, follow_redirects=True)
        if r.status_code >= 400:
            return []
        rows = []
        for line in r.text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return rows
    except Exception:
        return []


def search_corpus(query: str, agent: str | None = None, limit: int = 5) -> dict[str, Any]:
    """Busca keyword no manifest + ficheiros corpus conhecidos."""
    token = _token()
    if not token:
        return {"ok": False, "error": "HF_TOKEN not set", "hits": []}

    q = (query or "").strip().lower()
    if len(q) < 2:
        return {"ok": False, "error": "query too short", "hits": []}

    manifest: dict[str, Any] = {}
    try:
        url = f"https://huggingface.co/api/datasets/{_dataset()}/resolve/main/corpus/manifest.json"
        r = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=20.0, follow_redirects=True)
        if r.is_success:
            manifest = r.json()
    except Exception:
        manifest = {}

    candidate_paths: list[str] = []
    for f in manifest.get("files") or []:
        if isinstance(f, dict) and f.get("corpus_path"):
            if agent and f.get("agent") and f["agent"] != agent:
                continue
            candidate_paths.append(f["corpus_path"])

    if not candidate_paths:
        candidate_paths = _list_corpus_paths()

    if not candidate_paths:
        candidate_paths = [
            "corpus/openclaw-core/POLITICA-SEGURANCA.md.jsonl",
            "corpus/manifest.json",
        ]

    hits: list[dict[str, Any]] = []
    tokens = [t for t in re.split(r"\W+", q) if len(t) > 2]

    for path in candidate_paths[:40]:
        if path.endswith("manifest.json"):
            continue
        for row in _fetch_jsonl(path):
            text = str(row.get("text") or "")
            hay = text.lower()
            score = sum(1 for t in tokens if t in hay)
            if agent and row.get("agent") and row["agent"] != agent:
                continue
            if score > 0 or q in hay:
                hits.append(
                    {
                        "score": score,
                        "id": row.get("id"),
                        "agent": row.get("agent"),
                        "path": row.get("path"),
                        "text": text[:1200],
                        "tags": row.get("tags") or [],
                    }
                )

    hits.sort(key=lambda h: h.get("score", 0), reverse=True)
    return {"ok": True, "query": query, "agent": agent, "hits": hits[:limit], "dataset": _dataset()}
