import {
  buildFlowMonitorReport,
  formatFlowTelegram,
  saveFlowSnapshot,
} from './repo-scripts/heimdall-flow-core.mjs';

/** Executor skill ecosystem-watch */
export async function runEcosystemWatch() {
  const report = await buildFlowMonitorReport();
  report.reply = formatFlowTelegram(report);
  try {
    saveFlowSnapshot(report);
  } catch {
    report.snapshot_saved = false;
  }
  return report;
}
