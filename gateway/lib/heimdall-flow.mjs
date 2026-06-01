import {
  buildFlowMonitorReport,
  formatFlowTelegram,
  saveFlowSnapshot,
} from './repo-scripts/heimdall-flow-core.mjs';

/** Executor skill ecosystem-watch */
export async function runEcosystemWatch() {
  const report = await buildFlowMonitorReport();
  report.reply = formatFlowTelegram(report);
  saveFlowSnapshot(report);
  return report;
}
