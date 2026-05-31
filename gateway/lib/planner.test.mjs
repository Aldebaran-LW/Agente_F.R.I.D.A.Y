import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planFromMessage, resetWorkflowCache } from './planner.mjs';
import { routeMessage } from './jarvis-router.mjs';

describe('planFromMessage', () => {
  it('detecta workflow portfolio-status', () => {
    resetWorkflowCache();
    const plan = planFromMessage('resumo do portfolio');
    assert.equal(plan.kind, 'workflow');
    assert.equal(plan.workflowId, 'portfolio-status');
  });

  it('mantem rota unica para status macofel', () => {
    resetWorkflowCache();
    const plan = planFromMessage('status macofel');
    assert.equal(plan.kind, 'single');
    assert.equal(plan.route.agent, 'macofel');
  });

  it('workflow sync exige aprovacao', () => {
    resetWorkflowCache();
    const plan = planFromMessage('sync imagens macofel');
    assert.equal(plan.kind, 'workflow');
    assert.equal(plan.workflowId, 'macofel-sync');
    assert.equal(plan.approvalRequired, true);
  });
});

describe('routeMessage portal Texte', () => {
  it('status portal -> deploy-monitor', () => {
    const route = routeMessage('status portal');
    assert.equal(route.agent, 'heimdall');
    assert.equal(route.skill, 'deploy-monitor');
  });

  it('deploy texte -> vercel-status', () => {
    const route = routeMessage('ultimo deploy texte');
    assert.equal(route.agent, 'heimdall');
    assert.equal(route.skill, 'vercel-status');
  });
});
