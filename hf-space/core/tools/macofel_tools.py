"""Tools Macofel — protótipo; produção via gateway Vercel / agente EC2."""

from smolagents import tool


@tool
def buscar_peca(nome_peca: str) -> str:
    """Busca informações de uma peça no catálogo Macofel (stub no HF).

    Args:
        nome_peca: Nome ou código da peça.
    """
    return (
        f"[stub HF] Peça «{nome_peca}»: use gateway Macofel ou EC2 para dados reais. "
        "Política: sem Mongo neste Space."
    )


@tool
def listar_categorias() -> str:
    """Lista categorias principais do catálogo (stub)."""
    return "[stub HF] Categorias: filtros, freios, motor, suspensão — ligar MACOFEL_API_BASE no gateway."
