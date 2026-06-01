import { fetchDeployHealth } from './deploy.mjs';
import {
  buildTokenMonitorReport,
  formatMonitorTelegram,
  fetchOpenRouterKeyInfo,
} from '../../scripts/lib/rimuru-token-core.mjs';
import {
  checkAllProviders,
  summarizeProviders,
  providerAdvisories,
} from '../../scripts/lib/rimuru-providers.mjs';

/**
 * Executor gateway — skill innovation-monitor (Rimuru).
 */
export async function runInnovationMonitor(opts = {}) {
  const message = String(opts.message || '');
  const includeDeploy = opts.deploy !== false;
  let deploy = null;
  if (includeDeploy) {
    try {
      deploy = await fetchDeployHealth();
    } catch {
      deploy = null;
    }
  }

  const report = await buildTokenMonitorReport({ deploy, hubDaily: undefined });
  const providers = await checkAllProviders(fetchOpenRouterKeyInfo);
  report.providers = providers;
  report.provider_summary = summarizeProviders(providers);
  report.advisories = [
    ...providerAdvisories(providers),
    ...(report.advisories || []).filter((a) => a.id !== 'openrouter-high' && a.id !== 'openrouter-missing'),
  ];
  const provLines = (report.provider_summary || []).join('\n• ');
  let reply = `${formatMonitorTelegram(report)}\n\nProvedores:\n• ${provLines}`;
  if (/alertar/i.test(message)) {
    const alerts = (report.advisories || [])
      .filter((a) => a.severity === 'alta' || a.severity === 'media')
      .map((a) => `⚠ ${a.mensagem}`);
    reply += alerts.length
      ? `\n\nAlertas:\n${alerts.join('\n')}`
      : '\n\nAlertas: nenhum (quotas OK).';
  }
  if (report.hub_daily?.configured) {
    reply += `\n\nHub hoje: ${report.hub_daily.today_runs} pedidos Jarvis.`;
  }
  report.reply = reply.slice(0, 1500);
  return report;
}
