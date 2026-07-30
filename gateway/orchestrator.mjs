/**
 * Durable Object — Orquestrador de Agentes OpenClaw
 * Mantém estado de workflows, aprovações, e coordena execução
 */

export class OrchestratorDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.workflows = new Map();
    this.approvals = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /workflow/:id — consultar status
    if (request.method === 'GET' && path.startsWith('/workflow/')) {
      const id = path.split('/')[2];
      const workflow = this.workflows.get(id);
      return new Response(JSON.stringify(workflow || { ok: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST /workflow — criar novo workflow
    if (request.method === 'POST' && path === '/workflow') {
      const body = await request.json();
      const id = body.workflowId || crypto.randomUUID();
      const workflow = {
        id,
        kind: body.kind,
        status: 'pending',
        tasks: body.tasks || [],
        approvalRequired: body.approvalRequired || false,
        approvalGranted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.workflows.set(id, workflow);
      return new Response(JSON.stringify(workflow), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // PATCH /workflow/:id/approve — aprovar workflow
    if (request.method === 'PATCH' && path.includes('/approve')) {
      const id = path.split('/')[2];
      const workflow = this.workflows.get(id);
      if (workflow) {
        workflow.approvalGranted = true;
        workflow.status = 'approved';
        workflow.updatedAt = new Date().toISOString();
        this.workflows.set(id, workflow);
      }
      return new Response(JSON.stringify(workflow || { ok: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST /approval — registrar approval pendente (Telegram)
    if (request.method === 'POST' && path === '/approval') {
      const body = await request.json();
      const id = body.approvalId || crypto.randomUUID();
      const approval = {
        id,
        workflowId: body.workflowId,
        agent: body.agent,
        skill: body.skill,
        message: body.message,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60000).toISOString(), // 5min TTL
      };
      this.approvals.set(id, approval);
      return new Response(JSON.stringify(approval), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GET /approvals — listar pendentes
    if (request.method === 'GET' && path === '/approvals') {
      const pending = Array.from(this.approvals.values()).filter(
        (a) => a.status === 'pending' && new Date(a.expiresAt) > new Date()
      );
      return new Response(JSON.stringify({ approvals: pending }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  // Limpeza de histórico (via scheduled trigger)
  async cleanup() {
    const now = new Date();
    for (const [id, approval] of this.approvals) {
      if (new Date(approval.expiresAt) < now) {
        this.approvals.delete(id);
      }
    }
  }
}
