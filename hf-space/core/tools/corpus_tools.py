"""Tool RAG — corpus docs no Dataset HF."""

from smolagents import tool

from lib.corpus_client import search_corpus


@tool
def search_openclaw_docs(query: str, agent: str = "") -> str:
    """Pesquisa documentacao OpenClaw no Dataset HF (corpus/).
    Args:
        query: termos de pesquisa (ex. cron heimdall, politica seguranca)
        agent: filtro opcional (heimdall, macofel, sophia, orchestrator)
    """
    out = search_corpus(query, agent=agent.strip() or None, limit=4)
    if not out.get("ok"):
        return f"[corpus] {out.get('error', 'indisponivel')}"
    hits = out.get("hits") or []
    if not hits:
        return f"[corpus] Nenhum resultado para «{query}». Corre hf-ingest-corpus.mjs no PC."
    lines = []
    for h in hits:
        lines.append(f"— {h.get('path')} (agent={h.get('agent')}, score={h.get('score')})\n{h.get('text', '')[:500]}")
    return "\n\n".join(lines)
