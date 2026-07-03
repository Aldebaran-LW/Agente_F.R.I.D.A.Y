import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { taskWaves } from './workflow-waves.mjs';

describe('taskWaves', () => {
  it('agrupa tasks independentes na mesma onda', () => {
    const tasks = [
      { id: 'a', deps: [] },
      { id: 'b', deps: [] },
      { id: 'c', deps: [] },
    ];
    const waves = taskWaves(tasks);
    assert.equal(waves.length, 1);
    assert.equal(waves[0].length, 3);
  });

  it('respeita deps sequenciais', () => {
    const tasks = [
      { id: 'preflight', deps: [] },
      { id: 'sync', deps: ['preflight'] },
    ];
    const waves = taskWaves(tasks);
    assert.equal(waves.length, 2);
    assert.deepEqual(waves[0].map((t) => t.id), ['preflight']);
    assert.deepEqual(waves[1].map((t) => t.id), ['sync']);
  });

  it('portfolio-status tem uma onda paralela de 4', () => {
    const tasks = [
      { id: 'macofel', deps: [] },
      { id: 'github', deps: [] },
      { id: 'deploy', deps: [] },
      { id: 'vp', deps: [] },
    ];
    const waves = taskWaves(tasks);
    assert.equal(waves.length, 1);
    assert.equal(waves[0].length, 4);
  });
});
