import { assertSkillAllowed, skillTimeoutMs } from './skill-registry.mjs';
import { fetchMacofelStatus } from './macofel.mjs';
import { syncMacofelImages } from './macofel-sync.mjs';
import { fetchGithubStatus } from './github.mjs';
import { fetchDeployHealth } from './deploy.mjs';
import { fetchVercelStatus } from './vercel.mjs';
import { fetchVpPecasHealth } from './vp-pecas.mjs';
import { forwardTask } from './orchestrate.mjs';

/** Skills sem executor local — delegam via orchestrate (HF / EC2). */
const ORCHESTRATE_SKILLS = new Set([
  'innovation-research',
  'innovation-viability',
  'innovation-design',
  'innovation-build',
  'innovation-monitor',
  'innovation-test',
  'security-audit',
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
  };
}

function topoSort(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const done = new Set();
  const order = [];
  let guard = tasks.length * tasks.length + 1;

  while (order.length < tasks.length && guard-- > 0) {
    let progressed = false;
    for (const t of tasks) {
      if (done.has(t.id)) continue;
      const deps = t.deps ?? [];
      if (deps.every((d) => done.has(d))) {
        order.push(t);
        done.add(t.id);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return order.length === tasks.length ? order : tasks;
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
  const blocked =
    approvalRequired && !approved && !isApprovalMessage(message);

  const taskRuns = [];
  let data = null;

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

  if (!blocked) {
    const allowed = assertSkillAllowed(route.skill, {
      write: route.skill?.includes('sync'),
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
      try {
        const run = ORCHESTRATE_SKILLS.has(route.skill)
          ? () => forwardTask(route.agent, message)
          : () => executeSkill(route.skill, params);
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
  } else {
    taskRuns.push({
      id: 'single',
      skill: route.skill,
      status: 'blocked',
      ms: 0,
    });
  }

  return {
    route,
    approvalBlocked: blocked,
    taskRuns,
    data,
    results: data ? { [route.skill]: data } : {},
  };
}

async function executeWorkflow(plan, { message, approved, params }) {
  const wf = plan.workflow;
  const ordered = topoSort(wf.tasks ?? []);
  const taskRuns = [];
  const results = {};
  let approvalBlocked = false;
  const userApproved = approved || isApprovalMessage(message);

  for (const task of ordered) {
    const taskNeedsApproval =
      task.requiresApproval || task.skill === 'macofel-images-sync';

    if (taskNeedsApproval && !userApproved) {
      approvalBlocked = true;
      taskRuns.push({
        id: task.id,
        skill: task.skill,
        status: 'blocked',
        ms: 0,
      });
      continue;
    }

    const allowed = assertSkillAllowed(task.skill, {
      write: task.skill?.includes('sync'),
    });
    if (!allowed.ok) {
      taskRuns.push({
        id: task.id,
        skill: task.skill,
        status: 'failed',
        ms: 0,
        error: allowed.error,
      });
      continue;
    }

    const executors = buildExecutors(params);
    const executor = executors[task.skill];
    if (!executor) {
      taskRuns.push({
        id: task.id,
        skill: task.skill,
        status: 'skipped',
        ms: 0,
        error: 'sem executor no gateway (executar na EC2)',
      });
      continue;
    }

    const t0 = Date.now();
    try {
      const data = await runWithTimeout(
        executeSkill(task.skill, params),
        skillTimeoutMs(task.skill)
      );
      results[task.skill] = data;
      taskRuns.push({
        id: task.id,
        skill: task.skill,
        status: data?.ok === false ? 'failed' : 'done',
        ms: Date.now() - t0,
        data,
      });
    } catch (err) {
      taskRuns.push({
        id: task.id,
        skill: task.skill,
        status: 'failed',
        ms: Date.now() - t0,
        error: String(err.message || err),
      });
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
