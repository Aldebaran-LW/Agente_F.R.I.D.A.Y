import { buildInnovationStatus } from './repo-scripts/innovation-status-core.mjs';

export async function fetchInnovationStatus(opts = {}) {
  const days = Number(opts.days) || 7;
  try {
    return buildInnovationStatus({ days });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
