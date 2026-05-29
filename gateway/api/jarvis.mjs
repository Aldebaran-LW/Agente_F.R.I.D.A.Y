import { handleOptions, requireAuth, setCors } from '../lib/auth.mjs';
import { planFromMessage } from '../lib/planner.mjs';
import { executePlan } from '../lib/workflow-engine.mjs';
import { buildReply, buildWorkflowReply } from '../lib/jarvis-reply.mjs';
import { newTraceId, buildAuditEntry } from '../lib/audit.mjs';
import { listSkills } from '../lib/skill-registry.mjs';
import { buildTelegramPayload } from '../lib/telegram-format.mjs';
import { persistWorkflowRun, touchConversationSession } from '../lib/hub-store.mjs';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      agent: 'jarvis',
      role: 'orchestrator',
      owner: 'Lucas / Aldebaran-LW',
      version: '1.1.0',
      agent_os: 'fase-a',
      endpoints: {
        jarvis: 'POST /jarvis { "message": "...", "approved": false }',
        macofel: 'GET /openclaw/macofel/status',
        github: 'GET /openclaw/github/status',
        deploy: 'GET /openclaw/deploy/health',
        hub: 'GET /openclaw/hub/recent · POST /openclaw/hub/ingest',
        orchestrate: 'GET/POST /openclaw/orchestrate { "agent", "task" }',
      },
      delegates: ['macofel', 'vp-pecas', 'ops'],
      workflows: ['portfolio-status', 'macofel-sync'],
      skills: listSkills(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  if (!requireAuth(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const message = body.message || body.text || '';
  const approved = Boolean(body.approved);

  const traceId = newTraceId();
  const plan = planFromMessage(message, { approved });
  const execution = await executePlan(plan, { message, approved });

  let reply;
  if (plan.kind === 'workflow') {
    reply = buildWorkflowReply({
      workflowId: plan.workflowId,
      results: execution.results,
      approvalBlocked: execution.approvalBlocked,
    });
  } else {
    reply = buildReply(execution.route, execution.data, {
      approvalBlocked: execution.approvalBlocked,
    });
  }

  const audit = buildAuditEntry({
    traceId,
    message,
    plan,
    taskRuns: execution.taskRuns,
    approval: {
      required: plan.approvalRequired,
      blocked: execution.approvalBlocked,
      approved: approved || /^(sim|confirmar|ok)\b/i.test(String(message).trim()),
    },
  });

  console.log(JSON.stringify({ event: 'jarvis.run', ...audit }));

  persistWorkflowRun({ traceId, message, plan, audit, execution }).catch((e) => {
    console.warn(JSON.stringify({ event: 'hub.workflow_run_failed', traceId, error: e.message }));
  });

  const peerId = body.peer_id || body.chat_id || body.telegram_chat_id;
  if (peerId) {
    touchConversationSession({
      peerId: String(peerId),
      messagePreview: message,
      contextPatch: { last_trace_id: traceId, last_plan_kind: plan.kind },
    }).catch((e) => {
      console.warn(JSON.stringify({ event: 'hub.session_failed', error: e.message }));
    });
  }

  const telegram = buildTelegramPayload({
    plan,
    route: execution.route,
    payload: execution.data,
    results: execution.results,
    approvalBlocked: execution.approvalBlocked,
    plainReply: reply,
  });

  return res.status(200).json({
    ok: true,
    agent: 'jarvis',
    traceId,
    plan: {
      kind: plan.kind,
      workflowId: plan.workflowId ?? null,
      route: plan.route ?? null,
    },
    delegate:
      plan.kind === 'workflow'
        ? 'multi'
        : execution.route?.agent,
    skill:
      plan.kind === 'workflow'
        ? plan.workflowId
        : execution.route?.skill,
    reply,
    telegram,
    data: execution.data ?? execution.results ?? null,
    workflow: plan.kind === 'workflow'
      ? {
          id: plan.workflowId,
          tasks: execution.taskRuns.map((t) => ({
            id: t.id,
            skill: t.skill,
            status: t.status,
            ms: t.ms,
          })),
        }
      : null,
    approval: audit.approval,
    audit,
    at: audit.at,
  });
}
