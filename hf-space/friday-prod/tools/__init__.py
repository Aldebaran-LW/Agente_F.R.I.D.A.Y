from tools.macofel_tools import buscar_peca, listar_categorias
from tools.ops_tools import status_github, status_deploy
from tools.vp_pecas_tools import health_site_vp

TOOL_REGISTRY = {
    "buscar_peca": buscar_peca,
    "listar_categorias": listar_categorias,
    "status_github": status_github,
    "status_deploy": status_deploy,
    "health_site_vp": health_site_vp,
}
