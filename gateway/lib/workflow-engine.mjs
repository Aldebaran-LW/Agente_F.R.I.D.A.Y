import { assertSkillAllowed, skillTimeoutMs, getSkill } from './skill-registry.mjs';
import { fetchMacofelStatus } from './macofel.mjs';
import { syncMacofelImages } from './macofel-sync.mjs';
import { fetchGithubStatus } from './github.mjs';
import { fetchDeployHealth } from './deploy.mjs';
import { fetchVercelStatus } from './vercel.mjs';
import { fetchVpPecasHealth } from './vp-pecas.mjs';
import { forwardTask } from './orchestrate.mjs';
import { runSecurityAudit } from './veldora.mjs';
import { runInnovationMonitor } from './rimuru.mjs';
import { runInnovationDesignScan } from './rebeca.mjs';
import { runEcosystemWatch } from './heimdall-flow.mjs';
import {
  runScheduledWhatsApp,
  tryConfirmPendingOnly,
} from './scheduled-whatsapp.mjs';
import { runWhatsAppContacts } from './whatsapp-contacts.mjs';
import { runWhatsAppSendContact } from './whatsapp-send-contact.mjs';
import { runUserPreferences } from './user-preferences.mjs';
import { runProposals } from './proposals.mjs';
import { runInnovationTest } from './icaro.mjs';
import {
  runCursorCloudAgent,
  tryConfirmCursorPendingOnly,
} from './cursor-agent.mjs';
import {
  checkRimuruGate,
  formatGateBlockReply,
  isLlmSkill,
} from './rimuru-gate.mjs';
import { taskWaves } from './workflow-waves.mjs';

/** Skills sem executor local — delegam via orchestrate (HF / EC2). */
const ORCHESTRATE_SKILLS = new Set([
  'innovation-knowledge',
  'innovation-market',
  'innovation-analysis',
  'innovation-forecast',
  'innovation-research',
  'innovation-viability',
  'innovation-build',
]);

function buildExecutors(params = {}) {
  return {
    'macofel-status': () => fetchMacofelStatus(),
    'macofel-images-sync': () =>
      syncMacofelImages({
        ean: params.ean,
        imageUrls: params.imageUrls,
      }),
    'github-aldebaran': () => fetchGithubStatus(),
    'deploy-monitor': () => fetchDeployHealth(),
    'vercel-status': () => fetchVercelStatus(),
    'vp-pecas-health': () => fetchVpPecasHealth(),
    'security-audit': () =>
      runSecurityAudit({
        message: params.message,
        url: params.url,
      }),
    'innovation-monitor': () =>
      runInnovationMonitor({ deploy: true, message: params.message }),
    'innovation-design': () =>
      runInnovationDesignScan({
        message: params.message,
        category: params.category,
      }),
    'ecosystem-watch': () => runEcosystemWatch(),
    'schedule-whatsapp': () =>
      runScheduledWhatsApp({ message: params.message }),
    'whatsapp-contacts': () =>
      runWhatsAppContacts({ message: params.message }),
    'whatsapp-send-contact': () =>
      runWhatsAppSendContact({ message: params.message }),
    'user-preferences': () =>
      runUserPreferences({ message: params.message }),
    'proposals-pipeline': () => runProposals({ message: params.message }),
    'innovation-test': () => runInnovationTest({ message: params.message }),
    'cursor-cloud-agent': () =>
      runCursorCloudAgent({
        message: params.message ?? '',
        approved: Boolean(params.approved),
      }),
  };
}

async function runWithTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout apos ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function executeSkill(skill, params = {}) {
  const executors = buildExecutors(params);
  const run = executors[skill];
  if (!run) {
    return { ok: false, error: `executor nao implementado: ${skill}` };
  }
  return run();
}

/**
 * Executa workflow ou rota unica. Retorna taskRuns + payloads por skill.
 */
export async function executePlan(plan, { message = '', approved = false, params = {} } = {}) {
  if (plan.kind === 'single') {
    return executeSingle(plan, { message, approved, params });
  }
  return executeWorkflow(plan, { message, approved, params });
}

async function executeSingle(plan, { message, approved, params }) {
  const { route, approvalRequired } = plan;
  const userApproved = approved || isApprovalMessage(message);
  const blocked =
    approvalRequired && !userApproved && route.skill !== 'cursor-cloud-agent';

  const taskRuns = [];
  let data = null;

  const pendingWa = await tryConfirmPendingOnly(message);
  if (pendingWa.handled) {
    taskRuns.push({
      id: 'single',
      skill: 'schedule-whatsapp',
      status: pendingWa.ok === false ? 'failed' : 'done',
      ms: 0,
    });
    return {
      route: { agent: 'jarvis', skill: 'schedule-whatsapp', intent: 'confirm' },
      approvalBlocked: false,
      taskRuns,
      data: pendingWa,
      results: { 'schedule-whatsapp': pendingWa },
    };
  }

  const pendingCursor = await tryConfirmCursorPendingOnly(message);
  if (pendingCursor.handled) {
    taskRuns.push({
      id: 'single',
      skill: 'cursor-cloud-agent',
      status: pendingCursor.ok === false ? 'failed' : 'done',
      ms: 0,
      data: pendingCursor,
    });
    return {
      route: { agent: 'heimdall', skill: 'cursor-cloud-agent', intent: 'confirm' },
      approvalBlocked: false,
      taskRuns,
      data: pendingCursor,
      results: { 'cursor-cloud-agent': pendingCursor },
    };
  }

  // Ajuda e respostas estaticas — sem executor externo
  if (route.skill === 'help') {
    taskRuns.push({
      id: 'single',
      skill: route.skill,
      status: 'done',
      ms: 0,
    });
    return {
      route,
      approvalBlocked: blocked,
      taskRuns,
      data: null,
      results: {},
    };
  }

  if (!blocked || route.skill === 'cursor-cloud-agent') {
    const skillMeta = getSkill(route.skill);
    const allowed = assertSkillAllowed(route.skill, {
      write: skillMeta?.mode === 'write',
    });
    if (!allowed.ok) {
      taskRuns.push({
        id: 'single',
        skill: route.skill,
        status: 'failed',
        ms: 0,
        error: allowed.error,
      });
    } else {
      const t0 = Date.now();
      const rimuruGate = isLlmSkill(route.skill) ? checkRimuruGate(route.skill) : null;
      if (rimuruGate && !rimuruGate.allowed) {
        data = {
          ok: false,
          blockedBy: 'rimuru',
          rimuru: rimuruGate,
          reply: formatGateBlockReply(rimuruGate),
        };
        taskRuns.push({
          id: 'single',
          skill: route.skill,
          status: 'blocked',
          ms: 0,
          data,
          error: rimuruGate.reason,
        });
      } else {
        try {
          const run = ORCHESTRATE_SKILLS.has(route.skill)
            ? () => forwardTask(route.agent, message, { skill: route.skill })
            : () =>
                executeSkill(route.skill, {
                  ...params,
                  message: params.message ?? message,
                  approved: userApproved,
                });
          data = await runWithTimeout(run(), skillTimeoutMs(route.skill));
          taskRuns.push({
            id: 'single',
            skill: route.skill,
            status: data?.ok === false ? 'failed' : 'done',
            ms: Date.now() - t0,
            data,
          });
        } catch (err) {
          taskRuns.push({
            id: 'single',
            skill: route.skill,
            status: 'failed',
            ms: Date.now() - t0,
            error: String(err.message || err),
          });
        }
      }
    }
  } else {
    taskRuns.push({
      id: 'single',
      skill: route.skill,
      status: 'blocked',
      ms: 0,
    });
  }

  const approvalBlocked =
    route.skill === 'cursor-cloud-agent'
      ? Boolean(data?.needsApproval)
      : blocked;

  return {
    route,
    approvalBlocked,
    taskRuns,
    data,
    results: data ? { [route.skill]: data } : {},
  };
}

async function runWorkflowTask(task, { message, userApproved, params }) {
  const taskNeedsApproval =
    task.requiresApproval || task.skill === 'macofel-images-sync';

  if (taskNeedsApproval && !userApproved) {
    return {
      approvalBlocked: true,
      run: {
        id: task.id,
        skill: task.skill,
        status: 'blocked',
        ms: 0,
      },
      result: null,
    };
  }

  const allowed = assertSkillAllowed(task.skill, {
    write: task.skill?.includes('sync'),
  });
  if (!allowed.ok) {
    return {
      approvalBlocked: false,
      run: {
        id: task.id,
        skill: task.skill,
        status: 'failed',
        ms: 0,
        error: allowed.error,
      },
      result: null,
    };
  }

  const executors = buildExecutors(params);
  const run =
    ORCHESTRATE_SKILLS.has(task.skill)
      ? () => forwardTask(task.agent, message, { skill: task.skill })
      : executors[task.skill];
  if (!run) {
    return {
      approvalBlocked: false,
      run: {
        id: task.id,
        skill: task.skill,
        status: 'skipped',
        ms: 0,
        error: 'sem executor no gateway (executar na EC2)',
      },
      result: null,
    };
  }

  const t0 = Date.now();
  const rimuruGate = isLlmSkill(task.skill) ? checkRimuruGate(task.skill) : null;
  if (rimuruGate && !rimuruGate.allowed) {
    const blocked = {
      ok: false,
      blockedBy: 'rimuru',
      rimuru: rimuruGate,
      reply: formatGateBlockReply(rimuruGate),
    };
    return {
      approvalBlocked: false,
      run: {
        id: task.id,
        skill: task.skill,
        status: 'blocked',
        ms: 0,
        data: blocked,
        error: rimuruGate.reason,
      },
      result: blocked,
    };
  }

  try {
    const data = await runWithTimeout(run(), skillTimeoutMs(task.skill));
    return {
      approvalBlocked: false,
      run: {
        id: task.id,
        skill: task.skill,
        status: data?.ok === false ? 'failed' : 'done',
        ms: Date.now() - t0,
        data,
      },
      result: data,
    };
  } catch (err) {
    return {
      approvalBlocked: false,
      run: {
        id: task.id,
        skill: task.skill,
        status: 'failed',
        ms: Date.now() - t0,
        error: String(err.message || err),
      },
      result: null,
    };
  }
}

async function executeWorkflow(plan, { message, approved, params }) {
  const wf = plan.workflow;
  const waves = taskWaves(wf.tasks ?? []);
  const taskRuns = [];
  const results = {};
  let approvalBlocked = false;
  const userApproved = approved || isApprovalMessage(message);

  for (const wave of waves) {
    const outcomes = await Promise.all(
      wave.map((task) => runWorkflowTask(task, { message, userApproved, params })),
    );
    for (let i = 0; i < wave.length; i++) {
      const task = wave[i];
      const outcome = outcomes[i];
      if (outcome.approvalBlocked) approvalBlocked = true;
      taskRuns.push(outcome.run);
      if (outcome.result !== null) {
        results[task.skill] = outcome.result;
      }
    }
  }

  return {
    workflowId: wf.id,
    approvalBlocked,
    taskRuns,
    results,
    data: null,
  };
}

function isApprovalMessage(message) {
  return /^(sim|confirmar|ok)\b/i.test(String(message).trim());
}
