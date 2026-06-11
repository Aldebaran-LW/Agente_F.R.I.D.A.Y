from tools.macofel_tools import buscar_peca, listar_categorias
from tools.ops_tools import status_github, status_deploy
from tools.vp_pecas_tools import health_site_vp
from tools.corpus_tools import search_openclaw_docs

TOOL_REGISTRY = {
    "buscar_peca": buscar_peca,
    "listar_categorias": listar_categorias,
    "status_github": status_github,
    "status_deploy": status_deploy,
    "health_site_vp": health_site_vp,
    "search_openclaw_docs": search_openclaw_docs,
}

# Corpus RAG disponivel em todos os perfis de Space
CORPUS_TOOL_NAMES = ["search_openclaw_docs"]
