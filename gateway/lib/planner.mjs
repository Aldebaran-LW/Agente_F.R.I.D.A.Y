import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeMessage, needsApproval } from './jarvis-router.mjs';
import { skillRequiresApproval } from './skill-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = join(__dirname, '..', 'workflows');

let workflowCache;

function loadWorkflows() {
  if (workflowCache) return workflowCache;
  const defs = [];
  for (const file of readdirSync(WORKFLOWS_DIR)) {
    if (!file.endsWith('.workflow.json')) continue;
    const raw = readFileSync(join(WORKFLOWS_DIR, file), 'utf8');
    defs.push(JSON.parse(raw));
  }
  workflowCache = defs;
  return defs;
}

function matchesTriggers(text, workflow) {
  const patterns = workflow.triggers?.patterns ?? [];
  return patterns.some((p) => {
    try {
      return new RegExp(p, 'i').test(text);
    } catch {
      return text.toLowerCase().includes(String(p).toLowerCase());
    }
  });
}

/**
 * Plano de execucao: workflow multi-step ou rota unica (legado).
 */
export function planFromMessage(message = '', { approved = false } = {}) {
  const text = String(message).trim();
  const workflows = loadWorkflows();

  for (const wf of workflows) {
    if (!matchesTriggers(text, wf)) continue;
    return {
      kind: 'workflow',
      workflowId: wf.id,
      workflow: wf,
      approved,
      approvalRequired:
        Boolean(wf.requiresApproval) || needsApproval(text),
    };
  }

  const route = routeMessage(text);
  return {
    kind: 'single',
    route,
    approved,
    approvalRequired:
      needsApproval(text) || skillRequiresApproval(route.skill),
  };
}

export function resetWorkflowCache() {
  workflowCache = undefined;
}
