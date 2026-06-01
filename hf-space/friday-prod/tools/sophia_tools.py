"""Sophia — pesquisa de conhecimento (HF Spaces + GitHub)."""

from __future__ import annotations

import os
from typing import Any

import httpx


def search_hf_spaces(topic: str, limit: int = 15) -> list[dict[str, Any]]:
    token = os.environ.get("HF_TOKEN", "").strip()
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    from urllib.parse import quote

    url = f"https://huggingface.co/api/spaces?search={quote(topic)}&limit={limit}"
    r = httpx.get(url, headers=headers, timeout=25.0)
    body = r.json() if r.is_success else []
    lst = body if isinstance(body, list) else body.get("spaces") or []
    out = []
    for s in lst:
        sid = s.get("id") or f"{s.get('author') or s.get('owner')}/{s.get('name')}"
        link = f"https://huggingface.co/spaces/{sid}"
        runtime = s.get("runtime") or {}
        out.append(
            {
                "id": sid,
                "link": link,
                "likes": s.get("likes", 0),
                "sdk": s.get("sdk"),
                "stage": runtime.get("stage") or s.get("stage"),
                "descricao": (s.get("cardData") or {}).get("short_description") or s.get("description") or "",
            }
        )
    return out


def search_github_trending(topic: str | None = None, limit: int = 10) -> list[dict[str, Any]]:
    q = topic or "openclaw ai agents"
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    from urllib.parse import quote

    url = (
        "https://api.github.com/search/repositories?q="
        + quote(f"{q} in:name,description,readme")
        + f"&sort=stars&order=desc&per_page={min(limit, 30)}"
    )
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "OpenClaw-Sophia"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = httpx.get(url, headers=headers, timeout=25.0)
    data = r.json() if r.is_success else {}
    items = []
    for repo in data.get("items") or []:
        items.append(
            {
                "nome": repo.get("full_name"),
                "stars": repo.get("stargazers_count"),
                "link": repo.get("html_url"),
                "descricao": (repo.get("description") or "")[:200],
            }
        )
    return items


def search_papers_with_code(topic: str) -> list[dict[str, Any]]:
    """Placeholder — API Papers with Code sem chave publica estavel."""
    return [{"note": "papers_with_code: integrar API quando chave disponivel", "topic": topic}]


def search_knowledge(topic: str) -> dict[str, Any]:
    spaces = search_hf_spaces(topic, 12)
    repos = search_github_trending(topic, 8)
    return {
        "ok": True,
        "agente": "sophia",
        "topico": topic,
        "hf_spaces": spaces,
        "github_repos": repos,
        "papers_with_code": search_papers_with_code(topic),
        "dataset_path": "knowledge/",
        "proximo_passo": "senku",
    }
