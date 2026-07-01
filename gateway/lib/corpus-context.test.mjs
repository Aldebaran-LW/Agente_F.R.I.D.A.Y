import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  searchCorpusIndex,
  enrichTaskWithCorpus,
  agentForSkill,
} from './corpus-context.mjs';

describe('corpus-context', () => {
  it('agentForSkill mapeia innovation-knowledge', () => {
    assert.equal(agentForSkill('innovation-knowledge'), 'sophia');
  });

  it('searchCorpusIndex encontra termos conhecidos', () => {
    const r = searchCorpusIndex('politica seguranca', { limit: 2 });
    if (r.hits.length === 0) {
      console.warn('corpus-index vazio — correr node scripts/build-corpus-index.mjs');
      return;
    }
    assert.ok(r.hits[0].path);
    assert.ok(r.hits[0].score > 0);
  });

  it('enrichTaskWithCorpus prefixa bloco quando ha hits', () => {
    const prev = process.env.CORPUS_CONTEXT_DISABLED;
    delete process.env.CORPUS_CONTEXT_DISABLED;
    try {
      const r = enrichTaskWithCorpus('heimdall heartbeat cron', { skill: 'innovation-knowledge' });
      if (r.enriched) {
        assert.match(r.task, /heimdall heartbeat cron/);
        assert.match(r.task, /\[OpenClaw corpus/);
      }
    } finally {
      if (prev !== undefined) process.env.CORPUS_CONTEXT_DISABLED = prev;
    }
  });
});
