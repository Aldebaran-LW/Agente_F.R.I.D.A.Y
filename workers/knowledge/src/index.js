import { json, error } from './response.js';
import { requireAuth } from './auth.js';

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!requireAuth(request, env)) return error('unauthorized', 401);

    if (request.method === 'GET' && (path === '/health' || path === '/')) {
      return json({ ok: true, agent: 'knowledge', version: '2.0.0', features: ['d1', 'vectorize', 'search', 'notify'] });
    }

    if (path === '/documents' && request.method === 'GET') {
      return listDocuments(request, env);
    }
    if (path === '/documents' && request.method === 'POST') {
      return addDocument(request, env, ctx);
    }
    if (path === '/search' && request.method === 'GET') {
      return searchDocuments(request, env);
    }
    if (path === '/search/semantic' && request.method === 'GET') {
      return semanticSearch(request, env);
    }
    if (path === '/notify' && request.method === 'POST') {
      return sendNotification(request, env);
    }
    if (path.startsWith('/documents/') && request.method === 'DELETE') {
      return deleteDocument(path.split('/')[2], env);
    }

    return error('not found', 404);
  },
};

async function listDocuments(request, env) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const result = await env.DB.prepare(
      'SELECT id, title, content, metadata, created_at FROM documents ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();
    return json({ ok: true, documents: result.results, total: result.results.length });
  } catch (e) {
    return error(`list failed: ${e.message}`, 500);
  }
}

async function addDocument(request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const { id, title, content, metadata } = body;

  if (!content) return error('content required');
  const docId = id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO documents (id, title, content, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(docId, title || '', content, JSON.stringify(metadata || {}), new Date().toISOString()).run();

    ctx.waitUntil(indexDocument(docId, content, env));

    return json({ ok: true, id: docId });
  } catch (e) {
    return error(`add failed: ${e.message}`, 500);
  }
}

async function indexDocument(text, env) {
  try {
    const embedding = await env.AI.run(EMBEDDING_MODEL, { text: Array.isArray(text) ? text : [text] });
    const vectors = embedding.data || [];

    if (vectors.length > 0) {
      await env.VECTORIZE.upsert([
        {
          id: `vec_${Date.now()}`,
          values: vectors[0],
          metadata: { text: Array.isArray(text) ? text[0] : text },
        },
      ]);
    }
  } catch (e) {
    console.error('indexing failed:', e.message);
  }
}

async function searchDocuments(request, env) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '10');

  if (!query) return error('query required');

  try {
    const result = await env.DB.prepare(
      'SELECT id, title, content, metadata, created_at FROM documents WHERE content LIKE ? OR title LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).bind(`%${query}%`, `%${query}%`, limit).all();

    return json({ ok: true, query, documents: result.results, total: result.results.length });
  } catch (e) {
    return error(`search failed: ${e.message}`, 500);
  }
}

async function semanticSearch(request, env) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '5');

  if (!query) return error('query required');

  try {
    const queryEmbedding = await env.AI.run(EMBEDDING_MODEL, { text: [query] });
    const vectors = queryEmbedding.data || [];

    if (vectors.length === 0) return json({ ok: true, query, results: [] });

    const searchResults = await env.VECTORIZE.query(vectors[0], { topK: limit, returnMetadata: true });

    return json({
      ok: true,
      query,
      results: searchResults.matches.map((m) => ({
        score: m.score,
        text: m.metadata?.text || '',
      })),
    });
  } catch (e) {
    return error(`semantic search failed: ${e.message}`, 500);
  }
}

async function sendNotification(request, env) {
  const body = await request.json().catch(() => ({}));
  const { title, body: message, tag = 'openclaw', target } = body;

  if (!message) return error('message required');

  if (target === 'telegram' || !target) {
    const chatId = env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID;
    const token = env.TELEGRAM_BOT_TOKEN;
    if (token && chatId) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: `<b>${title || 'OpenClaw'}</b>\n${message}`, parse_mode: 'HTML' }),
        });
      } catch (e) {
        return error(`telegram failed: ${e.message}`, 502);
      }
    }
  }

  return json({ ok: true, sent: true, tag });
}

async function deleteDocument(id, env) {
  if (!id) return error('id required');
  try {
    await env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(id).run();
    return json({ ok: true, id });
  } catch (e) {
    return error(`delete failed: ${e.message}`, 500);
  }
}
