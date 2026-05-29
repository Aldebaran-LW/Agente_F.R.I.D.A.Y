import { handleOptions, requireAuth, setCors } from '../../lib/auth.mjs';
import { forwardTask, listRoutes, resolveRoute } from '../../lib/orchestrate.mjs';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    return res.status(200).json({
      ok: true,
      service: 'friday-orchestrate',
      role: 'gateway broker — nao executa tarefas longas',
      timeoutMs: Number(process.env.ORCHESTRATE_TIMEOUT_MS || 8000),
      agents: listRoutes(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  if (!requireAuth(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const agent = body.agent || body.agent_id;
  const task = body.task || body.message || body.text || '';

  if (!agent) {
    return res.status(400).json({ ok: false, error: 'agent required' });
  }
  if (!task) {
    return res.status(400).json({ ok: false, error: 'task required' });
  }

  const preview = resolveRoute(agent);
  if (!preview) {
    return res.status(404).json({ ok: false, error: 'agent not found', agent });
  }

  const result = await forwardTask(agent, task, { async: Boolean(body.async) });
  const status = result.ok ? 200 : (result.status || 502);
  return res.status(status).json({
    ok: result.ok,
    agent,
    residence: preview.target,
    mode: preview.mode,
    ...result,
  });
}
