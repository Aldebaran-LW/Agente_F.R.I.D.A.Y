import { randomUUID } from 'node:crypto';

export function newTraceId() {
  return randomUUID();
}

export function buildAuditEntry({
  traceId,
  message,
  plan,
  taskRuns = [],
  approval = {},
}) {
  return {
    traceId,
    at: new Date().toISOString(),
    message_preview: String(message).slice(0, 200),
    plan_kind: plan?.kind,
    workflow_id: plan?.workflowId ?? null,
    approval,
    tasks: taskRuns.map((t) => ({
      id: t.id,
      skill: t.skill,
      status: t.status,
      ms: t.ms,
      error: t.error ?? null,
    })),
  };
}
