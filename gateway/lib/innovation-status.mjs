import { buildInnovationStatus } from '../../scripts/lib/innovation-status-core.mjs';

export async function fetchInnovationStatus(opts = {}) {
  const days = Number(opts.days) || 7;
  try {
    return buildInnovationStatus({ days });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
