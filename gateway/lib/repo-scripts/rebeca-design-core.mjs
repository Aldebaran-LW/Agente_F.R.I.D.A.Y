/**
 * Rebeca — probe HF Spaces + catálogo de ferramentas de design (sem APIs fictícias).
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { isAllowedSource } from '../veldora/validate-sources.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readLines(file) {
  const p = resolve(root, 'agents', 'rebeca', file);
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

export function loadDesignCatalog() {
  const p = resolve(root, 'agents', 'rebeca', 'design-tools-catalog.json');
  if (!existsSync(p)) return [];
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  return doc.tools ?? [];
}

/**
 * @param {string} spaceId — ex. Aldebaran-LW/friday-prod
 */
export async function probeHfSpace(spaceId) {
  const id = String(spaceId || '').trim();
  if (!id.includes('/')) {
    return { space: id, ok: false, error: 'formato esperado: org/nome' };
  }

  const apiUrl = `https://huggingface.co/api/spaces/${id}`;
  const token = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_HUB_TOKEN?.trim();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(20000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        space: id,
        ok: false,
        status: res.status,
        error: body.error || 'space não encontrado ou privado',
      };
    }

    const runtime = body.runtime || {};
    const stage = runtime.stage || body.stage || 'unknown';
    const useful =
      stage === 'RUNNING'
      || body.sdk
      || Boolean(body.models?.length);

    return {
      space: id,
      ok: res.ok,
      sdk: body.sdk,
      stage,
      likes: body.likes,
      useful,
      link: `https://huggingface.co/spaces/${id}`,
      recomendacao: useful ? 'manter na watchlist' : 'revisar ou arquivar',
    };
  } catch (e) {
    return { space: id, ok: false, error: String(e.message || e) };
  }
}

export async function probeAllWatchlistSpaces() {
  const ids = readLines('hf-spaces-watchlist.txt');
  const results = [];
  for (const id of ids) {
    results.push(await probeHfSpace(id));
  }
  const useful = results.filter((r) => r.useful);
  return {
    ok: results.some((r) => r.ok),
    total: results.length,
    useful_count: useful.length,
    spaces: results,
    copiar: useful.map((r) => ({ space: r.space, link: r.link, sdk: r.sdk })),
    descartar: results.filter((r) => !r.useful && r.ok).map((r) => r.space),
  };
}

/**
 * @param {string} [query] — web, foto, video, 3d, ui
 */
export function searchDesignTools(query = '') {
  const q = String(query).toLowerCase();
  const tools = loadDesignCatalog();
  const filtered = tools.filter((t) => {
    if (!q) return true;
    const cats = (t.categoria || []).join(' ').toLowerCase();
    const nome = (t.nome || '').toLowerCase();
    return cats.includes(q) || nome.includes(q) || q.split(/\s+/).some((w) => cats.includes(w));
  });

  const toolsOut = filtered
    .filter((t) => t.link)
    .map((t) => ({
      nome: t.nome,
      categoria: t.categoria,
      tier: t.tier,
      link: t.link,
      nota: t.nota,
      link_aprovado_veldora: isAllowedSource(t.link),
    }));

  return {
    query: q || 'todas',
    total: toolsOut.length,
    tools: toolsOut,
  };
}

export function formatListaCatalog() {
  const tools = loadDesignCatalog();
  const lines = ['Rebeca [lista ferramentas]:', ''];
  for (const t of tools) {
    lines.push(`• ${t.nome} [${t.tier}] — ${(t.categoria || []).join(', ')}`);
  }
  lines.push('', `Total: ${tools.length}. Ver docs/DESIGN-FERRAMENTAS-GRATUITAS.md`);
  return lines.join('\n').slice(0, 1500);
}

export function findLatestDesignReport() {
  const base = resolve(root, 'data', 'design');
  if (!existsSync(base)) return null;
  let best = null;
  for (const day of readdirSync(base)) {
    const dir = join(base, day);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.startsWith('rebeca_search_') || !f.endsWith('.json')) continue;
      const p = join(dir, f);
      const mtime = statSync(p).mtimeMs;
      if (!best || mtime > best.mtime) best = { path: p, mtime };
    }
  }
  if (!best) return null;
  try {
    return { ...JSON.parse(readFileSync(best.path, 'utf8')), saved_to: best.path };
  } catch {
    return { saved_to: best.path, error: 'parse failed' };
  }
}

export function formatRelatorioTelegram(report) {
  if (!report) {
    return 'Rebeca: nenhum relatório em data/design/. Corra rebeca-design-search.mjs primeiro.';
  }
  const n = report.candidatos?.length ?? report.total_hits ?? 0;
  const lines = [
    `Rebeca [relatório]: ${n} candidatos HF.`,
    `Ficheiro: ${report.saved_to || '?'}`,
  ];
  for (const c of (report.candidatos || []).slice(0, 6)) {
    lines.push(`• ${c.id} — ${c.search_query || ''}`);
  }
  return lines.join('\n').slice(0, 1500);
}

/**
 * Comandos Telegram: pesquisar | relatorio | lista
 */
export async function runRebecaCommand(message = '') {
  const msg = String(message || '').trim();
  const lower = msg.toLowerCase();

  if (/\blista\b/.test(lower)) {
    return {
      ok: true,
      mode: 'lista',
      reply: formatListaCatalog(),
      source: 'rebeca-lista',
    };
  }

  if (/\brelatorio\b/.test(lower)) {
    const report = findLatestDesignReport();
    return {
      ok: true,
      mode: 'relatorio',
      report,
      reply: formatRelatorioTelegram(report),
      source: 'rebeca-relatorio',
    };
  }

  if (/\bpesquisar\b/.test(lower)) {
    const q = msg.replace(/^.*pesquisar\s*/i, '').trim() || 'design';
    const { searchHfSpaces } = await import('../rebeca-design-search.mjs');
    const hits = await searchHfSpaces(q, 12);
    const candidatos = hits.filter((h) => h.candidato && h.link_ok);
    return {
      ok: true,
      mode: 'pesquisar',
      query: q,
      candidatos,
      reply: `Rebeca [pesquisa "${q}"]: ${candidatos.length} candidatos. Use rebeca-design-search.mjs para gravar relatório completo.`,
      source: 'rebeca-pesquisar',
    };
  }

  return null;
}

export async function buildDesignScanReport(opts = {}) {
  const message = String(opts.message || '').trim();
  const command = await runRebecaCommand(message);
  if (command) return command;
  const topicMatch = message.match(
    /(?:design|ferramenta|3d|video|foto|web|ui|animacao)\s*[:\-]?\s*(\w+)/i
  );
  const category = opts.category || topicMatch?.[1] || '';

  const hf = opts.spaces === false ? null : await probeAllWatchlistSpaces();
  const tools = searchDesignTools(category);

  const report = {
    ok: true,
    source: 'rebeca-design-scan',
    gerado_em: new Date().toISOString(),
    pedido: message.slice(0, 200) || null,
    hf_spaces: hf,
    design_tools: tools,
    proximo_passo: 'gerar design_brief YAML em data/innovation/ (pipeline ou HF Rebeca)',
  };

  return report;
}

export function formatDesignTelegram(report) {
  const lines = ['Rebeca [design scan]:'];
  if (report.hf_spaces) {
    lines.push(
      `HF: ${report.hf_spaces.useful_count}/${report.hf_spaces.total} spaces úteis na watchlist.`
    );
    for (const s of (report.hf_spaces.spaces || []).slice(0, 4)) {
      const st = s.ok ? (s.useful ? 'útil' : 'revisar') : 'falha';
      lines.push(`• ${s.space}: ${st}${s.stage ? ` (${s.stage})` : ''}`);
    }
  }
  lines.push(`Ferramentas (${report.design_tools.query}): ${report.design_tools.total} no catálogo.`);
  for (const t of (report.design_tools.tools || []).slice(0, 5)) {
    lines.push(`• ${t.nome} [${t.tier}] — ${t.categoria?.join(', ')}`);
  }
  return lines.join('\n').slice(0, 1500);
}
