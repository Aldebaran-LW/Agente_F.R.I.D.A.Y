import {
  isSupabaseConfigured,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
  supabasePing,
} from './supabase.mjs';

export { isSupabaseConfigured, supabasePing };

export function isHubEnabled() {
  return isSupabaseConfigured();
}

/**
 * Persiste audit do POST /jarvis.
 */
export async function persistWorkflowRun({
  traceId,
  message,
  plan,
  audit,
  execution = {},
}) {
  if (!isHubEnabled()) return null;

  const route = execution.route ?? plan?.route ?? null;
  const row = {
    trace_id: traceId,
    source: 'gateway',
    agent_id: route?.agent ?? 'orchestrator',
    message_preview: String(message || '').slice(0, 200),
    plan_kind: plan?.kind ?? null,
    workflow_id: plan?.workflowId ?? null,
    route_agent: route?.agent ?? null,
    route_skill: route?.skill ?? plan?.workflowId ?? null,
    approval: audit?.approval ?? {},
    tasks: audit?.tasks ?? [],
    meta: {
      delegates: plan?.delegates ?? null,
      approval_blocked: execution.approvalBlocked ?? false,
    },
  };

  return supabaseInsert('workflow_runs', row);
}

export async function persistSnapshot(kind, payload, { ok, source = 'gateway' } = {}) {
  if (!isHubEnabled()) return null;
  return supabaseInsert('snapshots', {
    kind,
    payload,
    ok: ok ?? payload?.ok ?? null,
    source,
  });
}

export async function persistLearning({ agentId, content, source = 'gateway', metadata = {} }) {
  if (!isHubEnabled()) return null;
  if (!agentId || !content) throw new Error('agent_id and content required');
  return supabaseInsert('agent_learnings', {
    agent_id: agentId,
    source,
    content: String(content).slice(0, 8000),
    metadata,
  });
}

export async function createApprovalRequest({
  traceId,
  agentId = 'orchestrator',
  actionType,
  summary,
  payload = {},
  requestedBy = 'telegram',
  channel,
  peerId,
}) {
  if (!isHubEnabled()) return null;
  return supabaseInsert('approval_requests', {
    trace_id: traceId ?? null,
    agent_id: agentId,
    action_type: actionType,
    status: 'pending',
    requested_by: requestedBy,
    channel: channel ?? null,
    peer_id: peerId ?? null,
    summary: summary ?? null,
    payload,
  });
}

export async function resolveApprovalRequest(id, status, { payloadPatch } = {}) {
  if (!isHubEnabled()) return null;
  const patch = {
    status,
    resolved_at: new Date().toISOString(),
  };
  if (payloadPatch) patch.payload = payloadPatch;
  return supabasePatch('approval_requests', { id: `eq.${id}` }, patch);
}

export async function touchConversationSession({
  channel = 'telegram',
  peerId,
  agentId = 'orchestrator',
  messagePreview,
  contextPatch = {},
}) {
  if (!isHubEnabled() || !peerId) return null;

  const params = new URLSearchParams({
    select: 'id,context',
    channel: `eq.${channel}`,
    peer_id: `eq.${peerId}`,
    limit: '1',
  });
  const existing = await supabaseSelect('conversation_sessions', params);

  if (existing?.length) {
    const prev = existing[0];
    const merged = { ...(prev.context || {}), ...contextPatch };
    return supabasePatch(
      'conversation_sessions',
      { id: `eq.${prev.id}` },
      {
        agent_id: agentId,
        context: merged,
        last_message_preview: messagePreview?.slice(0, 200) ?? null,
        last_message_at: new Date().toISOString(),
      },
    );
  }

  return supabaseInsert('conversation_sessions', {
    channel,
    peer_id: peerId,
    agent_id: agentId,
    context: contextPatch,
    last_message_preview: messagePreview?.slice(0, 200) ?? null,
    last_message_at: new Date().toISOString(),
  });
}

export async function fetchRecentHub({ limit = 20 } = {}) {
  const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const runsParams = new URLSearchParams({
    select: 'id,trace_id,agent_id,plan_kind,workflow_id,route_agent,message_preview,approval,created_at',
    order: 'created_at.desc',
    limit: String(n),
  });
  const learnParams = new URLSearchParams({
    select: 'id,agent_id,source,content,created_at',
    order: 'created_at.desc',
    limit: String(Math.min(n, 10)),
  });
  const approvalParams = new URLSearchParams({
    select: 'id,action_type,status,summary,agent_id,created_at',
    status: 'eq.pending',
    order: 'created_at.desc',
    limit: '10',
  });

  const [workflow_runs, agent_learnings, approval_requests] = await Promise.all([
    supabaseSelect('workflow_runs', runsParams),
    supabaseSelect('agent_learnings', learnParams),
    supabaseSelect('approval_requests', approvalParams),
  ]);

  return { workflow_runs, agent_learnings, approval_requests };
}

export async function fetchLatestSnapshots() {
  const params = new URLSearchParams({
    select: 'kind,id,ok,source,created_at',
    order: 'created_at.desc',
    limit: '50',
  });
  const rows = await supabaseSelect('snapshots', params);
  const byKind = {};
  for (const row of rows) {
    if (!byKind[row.kind]) byKind[row.kind] = row;
  }
  return byKind;
}

/**
 * Router POST /openclaw/hub/ingest
 */
export async function ingestHubRecord(type, data) {
  switch (type) {
    case 'workflow_run':
      return persistWorkflowRun(data);
    case 'snapshot':
      return persistSnapshot(data.kind, data.payload, {
        ok: data.ok,
        source: data.source,
      });
    case 'learning':
      return persistLearning({
        agentId: data.agent_id || data.agentId,
        content: data.content,
        source: data.source || 'gateway',
        metadata: data.metadata || {},
      });
    case 'approval_request':
      return createApprovalRequest({
        traceId: data.trace_id || data.traceId,
        agentId: data.agent_id || data.agentId,
        actionType: data.action_type || data.actionType,
        summary: data.summary,
        payload: data.payload || {},
        requestedBy: data.requested_by || data.requestedBy,
        channel: data.channel,
        peerId: data.peer_id || data.peerId,
      });
    case 'approval_resolve': {
      const id = data.id;
      const status = data.status;
      if (!id || !status) throw new Error('approval_resolve requires id and status');
      return resolveApprovalRequest(id, status, { payloadPatch: data.payload });
    }
    case 'session_touch':
      return touchConversationSession({
        channel: data.channel,
        peerId: data.peer_id || data.peerId,
        agentId: data.agent_id || data.agentId,
        messagePreview: data.message_preview || data.messagePreview,
        contextPatch: data.context || {},
      });
    default:
      throw new Error(`unknown ingest type: ${type}`);
  }
}
