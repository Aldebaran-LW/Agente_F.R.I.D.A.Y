"""
openrouter_client.py — DESCONTINUADO.

O OpenRouter foi removido da política Jarvis/EC2 (Junho 2026).
Este stub existe para evitar ImportError em código legado.
Migração: usar hf_inference_client ou groq_client diretamente.

Referência: agents/rimuru/config.yaml, docs/OPENROUTER-MODELOS-FREE.md
"""

from __future__ import annotations


def chat(prompt: str, system: str = "Assistente OpenClaw", model: str | None = None) -> str:
    raise RuntimeError(
        "OpenRouter descontinuado. "
        "Use HF Inference (HF_TOKEN) ou Groq (GROQ_API_KEY) como provider. "
        "Ver docs/LEQUE-IAS.md para alternativas."
    )
