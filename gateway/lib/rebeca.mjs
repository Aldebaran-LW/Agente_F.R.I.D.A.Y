import {
  buildDesignScanReport,
  formatDesignTelegram,
} from '../../scripts/lib/rebeca-design-core.mjs';

/**
 * Executor gateway — skill innovation-design (scan determinístico; brief LLM no HF).
 */
export async function runInnovationDesignScan(opts = {}) {
  const report = await buildDesignScanReport({
    message: opts.message,
    category: opts.category,
    spaces: opts.spaces !== false,
  });
  report.reply = formatDesignTelegram(report);
  return report;
}
