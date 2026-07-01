import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLlmSkill,
  checkRimuruGate,
  checkLlmQuota,
  formatGateBlockReply,
} from './rimuru-gate.mjs';

describe('rimuru-gate', () => {
  it('macofel-status nao e skill LLM', () => {
    assert.equal(isLlmSkill('macofel-status'), false);
    const gate = checkRimuruGate('macofel-status');
    assert.equal(gate.allowed, true);
    assert.equal(gate.gated, false);
  });

  it('innovation-knowledge e skill LLM', () => {
    assert.equal(isLlmSkill('innovation-knowledge'), true);
  });

  it('cursor-cloud-agent e skill LLM', () => {
    assert.equal(isLlmSkill('cursor-cloud-agent'), true);
  });

  it('formatGateBlockReply inclui percentagem', () => {
    const text = formatGateBlockReply({
      reason: 'cota diária local ≥95%',
      status: { usagePct: 96, remaining: 1200, limit: 500000 },
    });
    assert.match(text, /96%/);
    assert.match(text, /Rimuru/);
  });

  it('checkLlmQuota respeita bypass', () => {
    const prev = process.env.RIMURU_GATE_DISABLED;
    process.env.RIMURU_GATE_DISABLED = '1';
    try {
      const gate = checkLlmQuota();
      assert.equal(gate.allowed, true);
      assert.equal(gate.bypass, true);
    } finally {
      if (prev === undefined) delete process.env.RIMURU_GATE_DISABLED;
      else process.env.RIMURU_GATE_DISABLED = prev;
    }
  });
});
