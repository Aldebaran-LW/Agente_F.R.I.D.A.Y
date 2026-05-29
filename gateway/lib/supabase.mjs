/**
 * Cliente mínimo Supabase REST (service_role no gateway Vercel).
 */

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function baseUrl() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!url) throw new Error('SUPABASE_URL not configured');
  return url;
}

function headers(prefer = 'return=representation') {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

/**
 * @param {string} table
 * @param {Record<string, unknown> | Record<string, unknown>[]} row
 */
export async function supabaseInsert(table, row) {
  const res = await fetch(`${baseUrl()}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers('return=representation'),
    body: JSON.stringify(row),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.message
      ? data.message
      : typeof data === 'object' && data?.error
        ? data.error
        : text || res.statusText;
    throw new Error(`Supabase insert ${table}: ${res.status} ${msg}`);
  }
  return Array.isArray(data) ? data[0] : data;
}

/**
 * @param {string} table
 * @param {Record<string, string>} filters — ex. { trace_id: 'eq.uuid' }
 * @param {Record<string, unknown>} patch
 */
export async function supabasePatch(table, filters, patch) {
  const qs = new URLSearchParams(filters).toString();
  const res = await fetch(`${baseUrl()}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: headers('return=representation'),
    body: JSON.stringify(patch),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`Supabase patch ${table}: ${res.status} ${text}`);
  }
  return data;
}

/**
 * @param {string} table
 * @param {URLSearchParams} params
 */
export async function supabaseSelect(table, params) {
  const res = await fetch(`${baseUrl()}/rest/v1/${table}?${params.toString()}`, {
    method: 'GET',
    headers: {
      ...headers('return=representation'),
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    data = [];
  }
  if (!res.ok) {
    throw new Error(`Supabase select ${table}: ${res.status} ${text}`);
  }
  return data;
}

/** Ping leve (conta workflow_runs). */
export async function supabasePing() {
  const params = new URLSearchParams({
    select: 'id',
    limit: '1',
  });
  await supabaseSelect('workflow_runs', params);
  return { ok: true };
}
