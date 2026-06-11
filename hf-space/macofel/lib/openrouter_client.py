"""Cliente OpenRouter opcional para enriquecer respostas."""

from __future__ import annotations

import os

import httpx


def chat(prompt: str, system: str = "Assistente OpenClaw", model: str | None = None) -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise ValueError("OPENROUTER_API_KEY em falta")

    model_id = (model or os.environ.get("OPENROUTER_DEFAULT_MODEL") or "google/gemma-3-27b-it:free").strip()
    if model_id.startswith("openrouter/"):
        model_id = model_id[len("openrouter/") :]

    r = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aldebaran-lw-friday-prod.hf.space",
            "X-Title": "OpenClaw F.R.I.D.A.Y.",
        },
        json={
            "model": model_id,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt[:6000]},
            ],
            "max_tokens": 1024,
            "temperature": 0.5,
        },
        timeout=90.0,
    )
    r.raise_for_status()
    data = r.json()
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
    return str(content or "").strip()
