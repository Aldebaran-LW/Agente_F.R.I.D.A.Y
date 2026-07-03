import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInnovationHitl,
  enrichInnovationProposal,
  isPendingStatus,
  enqueueHitlResume,
} from './proposal-hitl.mjs';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('proposal-hitl', () => {
  it('marca inovação como awaiting_approval com interrupt', () => {
    const p = enrichInnovationProposal({
      id: 'prop_test_1',
      type: 'innovation',
      title: 'Test',
    });
    assert.equal(p.status, 'awaiting_approval');
    assert.equal(p.hitl.interrupt_id, 'prop_test_1');
    assert.equal(p.hitl.workflow_id, 'innovation-pipeline');
    assert.equal(p.hitl.resumed, false);
  });

  it('isPendingStatus aceita pending legado', () => {
    assert.equal(isPendingStatus('pending'), true);
    assert.equal(isPendingStatus('awaiting_approval'), true);
    assert.equal(isPendingStatus('approved'), false);
  });

  it('enqueueHitlResume grava fila', () => {
    const dir = mkdtempSync(join(tmpdir(), 'openclaw-hitl-'));
    const proposal = {
      id: 'prop_test_2',
      title: 'T',
      hitl: buildInnovationHitl({ id: 'prop_test_2' }),
      context: { gideon_id: 'g1' },
    };
    const r = enqueueHitlResume(proposal, { dataRoot: dir });
    assert.equal(r.ok, true);
    assert.equal(r.skipped, undefined);
    const raw = JSON.parse(readFileSync(join(dir, 'innovation', 'hitl-resume.json'), 'utf8'));
    assert.equal(raw.items.length, 1);
    assert.equal(raw.items[0].proposal_id, 'prop_test_2');
    rmSync(dir, { recursive: true, force: true });
  });
});
