/**
 * Previsão determinística a partir da análise Senku.
 */
const THRESHOLD_HEFESTOS = Number(process.env.GIDEON_THRESHOLD || 70);

export function buildGideonPrediction(senkuBody) {
  const { correlacoes = [], resumo = {}, solicitacoes_pesquisa = [], topico = '' } = senkuBody;
  const forca = resumo.forca_media ?? 0;
  const nCorr = correlacoes.length;
  const gaps = solicitacoes_pesquisa.length;

  const confianca = Math.max(
    0,
    Math.min(
      100,
      Math.round(forca * 0.5 + nCorr * 8 - gaps * 12 + (resumo.itens_conhecimento > 0 ? 10 : 0) + (resumo.itens_mercado > 0 ? 10 : 0)),
    ),
  );

  const cenarios = [
    {
      nome: 'provavel',
      horizonte_meses: 6,
      descricao:
        nCorr > 0
          ? `Adoção gradual de ${topico} no portfólio; ${nCorr} sinal(is) alinhado(s) conhecimento+mercado.`
          : `Dados insuficientes — investir em pesquisa antes de construir.`,
    },
    {
      nome: 'melhor',
      horizonte_meses: 3,
      descricao: 'Integração rápida com skill OpenClaw e ganho operacional visível no Hub.',
    },
    {
      nome: 'pior',
      horizonte_meses: 12,
      descricao: 'Obsolescência ou concorrente consolida mercado antes da implementação.',
    },
  ];

  let recomendacao = 'arquivar';
  if (gaps >= 2) recomendacao = 'mais_pesquisa';
  else if (confianca >= THRESHOLD_HEFESTOS) recomendacao = 'hefestos';
  else if (confianca >= 45) recomendacao = 'mais_pesquisa';

  return {
    cenarios,
    sinais: correlacoes.slice(0, 5).map((c) => c.insight),
    confianca_score: confianca,
    viabilidade_score: confianca,
    recomendacao,
    threshold: THRESHOLD_HEFESTOS,
    justificativa:
      gaps > 0
        ? `Lacunas de dados (${gaps}); reforçar Sophia/Yato antes de Hefestos.`
        : confianca >= THRESHOLD_HEFESTOS
          ? 'Correlações e cobertura suficientes para proposta de construção (aprovação humana obrigatória).'
          : 'Confiança abaixo do limiar; arquivar ou pedir mais pesquisa.',
  };
}

export { THRESHOLD_HEFESTOS };
