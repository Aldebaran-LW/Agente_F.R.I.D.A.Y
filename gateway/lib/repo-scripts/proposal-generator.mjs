/**
 * Gera propostas (simulado / HF futuro) — não toca GitHub.
 */
import { randomBytes } from 'node:crypto';

const TEMPLATES = {
  maintenance: {
    title: (ctx) => `Manutenção: ${ctx.repo || 'repositório'}`,
    description: (ctx) =>
      `Issues antigas (${ctx.issues ?? '?'}), dependências ou deploy degradado. Revisar e fechar/atualizar.`,
    effort: 'medium',
    risk: 'low',
    proposedAction: 'create_github_issue',
  },
  innovation: {
    title: (ctx) => `Ideia: ${ctx.topic || 'nova oportunidade'}`,
    description: (ctx) =>
      `Com base em pesquisa de mercado (${ctx.source || 'HF/yato'}). Validar com Lucas antes de build.`,
    effort: 'high',
    risk: 'medium',
    proposedAction: 'hf_pipeline_then_github',
  },
  feature: {
    title: (ctx) => `Feature: ${ctx.name || 'melhoria'}`,
    description: (ctx) => ctx.detail || 'Melhoria sugerida para o portfólio.',
    effort: 'medium',
    risk: 'medium',
    proposedAction: 'create_github_issue',
  },
};

export function generateProposal(type = 'maintenance', context = {}) {
  const key = String(type)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const tpl = TEMPLATES[key] || TEMPLATES.maintenance;
  const id = `prop_${Date.now().toString(36)}_${randomBytes(2).toString('hex')}`;
  return {
    id,
    type: String(type),
    title: tpl.title(context),
    description: tpl.description(context),
    effort: tpl.effort,
    risk: tpl.risk,
    proposedAction: tpl.proposedAction,
    context,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
}
