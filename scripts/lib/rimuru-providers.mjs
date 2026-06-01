/**
 * Rimuru — verificação por provedor (leitura only, sem bloquear agentes).
 */

export async function fetchDeepSeekBalance() {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    return { provider: 'deepseek', configured: false, ok: false };
  }
  try {
    const res = await fetch('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        provider: 'deepseek',
        configured: true,
        ok: false,
        status: res.status,
        error: body.error?.message || body.message || String(res.status),
        hint: res.status === 402 ? 'saldo insuficiente (402)' : null,
      };
    }
    const infos = body.balance_infos || body.balance || body;
    return {
      provider: 'deepseek',
      configured: true,
      ok: true,
      balance_infos: infos,
      currency: body.currency,
      source: 'deepseek-balance',
    };
  } catch (e) {
    return { provider: 'deepseek', configured: true, ok: false, error: String(e.message || e) };
  }
}

export async function fetchGroqKeyInfo() {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    return { provider: 'groq', configured: false, ok: false };
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    return {
      provider: 'groq',
      configured: true,
      ok: res.ok,
      status: res.status,
      models: res.ok ? (body.data?.length ?? 0) : 0,
      error: res.ok ? null : body.error?.message || String(res.status),
      source: 'groq-models',
    };
  } catch (e) {
    return { provider: 'groq', configured: true, ok: false, error: String(e.message || e) };
  }
}

export async function fetchHfKeyInfo() {
  const token = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_HUB_TOKEN?.trim();
  if (!token) {
    return { provider: 'huggingface', configured: false, ok: false };
  }
  try {
    const res = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    return {
      provider: 'huggingface',
      configured: true,
      ok: res.ok,
      name: body.name,
      orgs: (body.orgs || []).map((o) => o.name).slice(0, 5),
      error: res.ok ? null : body.error || String(res.status),
      source: 'hf-whoami',
    };
  } catch (e) {
    return { provider: 'huggingface', configured: true, ok: false, error: String(e.message || e) };
  }
}

/** @param {import('./rimuru-token-core.mjs').fetchOpenRouterKeyInfo} fetchOpenRouter */
export async function checkAllProviders(fetchOpenRouter) {
  const [openrouter, deepseek, groq, huggingface] = await Promise.all([
    fetchOpenRouter(),
    fetchDeepSeekBalance(),
    fetchGroqKeyInfo(),
    fetchHfKeyInfo(),
  ]);
  return { openrouter, deepseek, groq, huggingface };
}

export function summarizeProviders(providers) {
  const lines = [];
  for (const [id, p] of Object.entries(providers || {})) {
    if (!p?.configured) {
      lines.push(`${id}: não configurado`);
      continue;
    }
    if (!p.ok) {
      lines.push(`${id}: falha${p.hint ? ` (${p.hint})` : ''}${p.error ? ` — ${p.error}` : ''}`);
      continue;
    }
    if (id === 'openrouter') {
      lines.push(`${id}: ok (uso ${p.usage ?? '?'}/${p.limit ?? '?'})`);
    } else if (id === 'deepseek') {
      lines.push(`${id}: ok (saldo consultado)`);
    } else if (id === 'groq') {
      lines.push(`${id}: ok (${p.models} modelos)`);
    } else if (id === 'huggingface') {
      lines.push(`${id}: ok (${p.name || 'token válido'})`);
    } else {
      lines.push(`${id}: ok`);
    }
  }
  return lines;
}

export function providerAdvisories(providers) {
  const out = [];
  const ds = providers?.deepseek;
  if (ds?.configured && !ds.ok && (ds.status === 402 || ds.hint)) {
    out.push({
      id: 'deepseek-402',
      severity: 'alta',
      mensagem: 'DeepSeek sem saldo — usar OpenRouter :free ou Ollama na EC2.',
    });
  }
  const or = providers?.openrouter;
  if (or?.configured && or.ok && or.limit != null && or.usage != null) {
    const pct = or.limit > 0 ? Math.round((or.usage / or.limit) * 100) : 0;
    if (pct >= 80) {
      out.push({
        id: 'openrouter-warn',
        severity: 'media',
        mensagem: `OpenRouter ~${pct}% — reduzir contexto ou usar scripts.`,
      });
    }
  }
  if (!or?.configured) {
    out.push({
      id: 'openrouter-off',
      severity: 'info',
      mensagem: 'OpenRouter não configurado neste ambiente.',
    });
  }
  return out;
}
