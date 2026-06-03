/**
 * Testa normalização slash → Jarvis e planeamento de workflows.
 */
import { normalizeJarvisMessage, describeRoute } from './lib/jarvis-route.mjs';
import { planFromMessage, resetWorkflowCache } from '../gateway/lib/planner.mjs';

resetWorkflowCache();

const cases = [
  { raw: '/quotas', agent: 'rimuru', skill: 'innovation-monitor' },
  { raw: '/office', workflowId: 'agents-status' },
  { raw: 'previsão de vendas para amanhã', workflowId: 'vendas-previsao' },
  { raw: '/status', agent: 'macofel', skill: 'macofel-status' },
];

let ok = 0;
for (const c of cases) {
  const norm = normalizeJarvisMessage(c.raw);
  const plan = planFromMessage(norm);
  const route = describeRoute(c.raw);
  let pass = false;
  if (c.workflowId) {
    pass = plan.kind === 'workflow' && plan.workflowId === c.workflowId;
  } else {
    pass =
      plan.kind === 'single' &&
      plan.route.agent === c.agent &&
      plan.route.skill === c.skill;
  }
  console.log(
    pass ? '[OK]' : '[FAIL]',
    c.raw,
    '→',
    norm,
    '|',
    plan.kind,
    plan.workflowId || plan.route?.skill
  );
  if (!pass) {
    console.log('  expected', c, 'got', route, plan);
  } else ok++;
}

if (ok !== cases.length) process.exit(1);
console.log(`\n${ok}/${cases.length} rotas OK`);
