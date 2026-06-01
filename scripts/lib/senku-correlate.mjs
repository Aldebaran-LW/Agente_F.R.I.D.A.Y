/**
 * Correlação determinística Sophia (conhecimento) + Yato (mercado).
 */
import { slugTopic, loadJson } from './innovation-io.mjs';

function itemsFromReport(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.spaces)) {
    return data.spaces.map((s) => ({
      nome: s.id || s.nome,
      link: s.link,
      fonte: 'conhecimento',
      metrica: s.likes ?? 0,
    }));
  }
  if (Array.isArray(data.repos)) {
    return data.repos.map((r) => ({
      nome: r.nome || r.id,
      link: r.link,
      fonte: 'conhecimento',
      metrica: r.stars ?? 0,
    }));
  }
  if (Array.isArray(data.sinais_mercado)) {
    return data.sinais_mercado.map((r) => ({
      nome: r.nome || r.id,
      link: r.link,
      fonte: 'mercado',
      metrica: r.stars ?? 0,
    }));
  }
  return [];
}

function normName(n) {
  return String(n || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * @param {string} topic
 * @param {object[]} knowledgeItems
 * @param {object[]} marketItems
 */
export function buildSenkuAnalysis(topic, knowledgeItems, marketItems) {
  const topicSlug = slugTopic(topic);
  const correlacoes = [];
  const vistos = new Set();

  for (const k of knowledgeItems) {
    const kn = normName(k.nome);
    for (const m of marketItems) {
      const mn = normName(m.nome);
      if (!kn || !mn) continue;
      if (kn.includes(mn) || mn.includes(kn) || kn.slice(0, 8) === mn.slice(0, 8)) {
        const key = `${kn}|${mn}`;
        if (vistos.has(key)) continue;
        vistos.add(key);
        correlacoes.push({
          nome: k.nome,
          conhecimento_link: k.link,
          mercado_link: m.link,
          insight:
            'Ferramenta com tração de mercado (★) e presença no ecossistema técnico — candidata a aprofundar.',
          forca: Math.min(100, Math.round((k.metrica + m.metrica) / 20)),
        });
      }
    }
  }

  const solicitacoes = [];
  if (knowledgeItems.length === 0) {
    solicitacoes.push({
      agente: 'sophia',
      pedido: `Pesquisar conhecimento e ferramentas sobre: ${topic}`,
      motivo: 'Sem dados de conhecimento no dia',
    });
  }
  if (marketItems.length === 0) {
    solicitacoes.push({
      agente: 'yato',
      pedido: `Pesquisar mercado e concorrência sobre: ${topic}`,
      motivo: 'Sem sinais de mercado no dia',
    });
  }
  if (correlacoes.length === 0 && knowledgeItems.length > 0 && marketItems.length > 0) {
    solicitacoes.push({
      agente: 'yato',
      pedido: `Aprofundar concorrentes e posicionamento de: ${topic}`,
      motivo: 'Conhecimento e mercado sem overlap detectado',
    });
  }

  const forcaMedia =
    correlacoes.length > 0
      ? Math.round(correlacoes.reduce((a, c) => a + c.forca, 0) / correlacoes.length)
      : knowledgeItems.length + marketItems.length > 0
        ? 40
        : 0;

  return {
    topico: topic,
    topico_slug: topicSlug,
    correlacoes,
    solicitacoes_pesquisa: solicitacoes,
    resumo: {
      itens_conhecimento: knowledgeItems.length,
      itens_mercado: marketItems.length,
      correlacoes_fortes: correlacoes.filter((c) => c.forca >= 50).length,
      forca_media: forcaMedia,
    },
    proximo_passo: 'gideon',
  };
}

export function extractItemsFromPaths(paths) {
  const knowledge = [];
  const market = [];
  for (const p of paths) {
    try {
      const data = loadJson(p);
      const agente = data.agente || data.source || '';
      const items = itemsFromReport(data);
      if (agente === 'yato' || String(p).includes('yato_market')) {
        market.push(...items);
      } else {
        knowledge.push(...items);
      }
      if (data.hf?.spaces) knowledge.push(...itemsFromReport({ spaces: data.hf.spaces }));
      else if (data.hf) knowledge.push(...itemsFromReport(data.hf));
      if (data.github?.items) knowledge.push(...itemsFromReport({ repos: data.github.items }));
      else if (data.github) knowledge.push(...itemsFromReport(data.github));
    } catch {
      /* skip */
    }
  }
  return { knowledge, market };
}
