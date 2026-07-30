export function buildReply(route, payload, { approvalBlocked = false } = {}) {
  if (approvalBlocked) {
    return 'Senhor, acao com impacto detectada. Aguardo sim, confirmar ou ok antes de executar.';
  }
  if (route.agent === 'macofel' && payload?.ok) {
    const p = payload.pending_review ?? '?';
    const img = payload.image_sync_pending ?? '?';
    const fail = payload.image_sync_failed ?? '?';
    return `Macofel: ${p} em revisao, ${img} imagem pendente, ${fail} falha(s). (fonte: ${payload.source || 'gateway'})`;
  }
  if (route.agent === 'macofel' && !payload?.ok) {
    return 'Nao consegui ler o catalogo Macofel.';
  }
  if (route.skill === 'github-aldebaran' && payload?.repos) {
    const lines = payload.repos.map((r) => formatGithubRepoLine(r));
    return 'GitHub:\n' + lines.join('\n');
  }
  if (route.skill === 'deploy-monitor' && payload?.sites) {
    const lines = payload.sites.map((s) =>
      s.ok ? `${formatSiteLabel(s.site)}: ${s.status} OK (${s.ms}ms)` : `${formatSiteLabel(s.site)}: FALHA`
    );
    return (payload.ok ? 'Sites OK.\n' : 'Atencao:\n') + lines.join('\n');
  }
  if (route.skill === 'vp-pecas-health' && payload?.sites) {
    const lines = payload.sites.map((s) =>
      s.ok ? `${s.site}: ${s.status} OK` : `${s.site}: FALHA`
    );
    return (payload.ok ? 'VP-Pecas OK.\n' : 'VP-Pecas atencao:\n') + lines.join('\n');
  }
  if (route.skill === 'vercel-status' && payload?.projects) {
    const lines = payload.projects.map((p) => {
      const st = p.latest?.state || 'sem deploy';
      const url = p.latest?.url ? ` (${p.latest.url})` : '';
      return `${p.name}: ${st}${url}`;
    });
    return 'Vercel:\n' + lines.join('\n');
  }
  if (route.skill === 'ollama-local') {
    if (payload?.needsApproval) return payload.reply;
    if (payload?.reply) return payload.reply;
    if (payload?.error) return `Ollama: ${payload.error}`;
  }
  if (route.skill === 'security-audit' && payload?.reply) {
    return payload.reply;
  }
  if (route.skill === 'security-audit' && payload?.veredito) {
    return `Veldora [${payload.veredito}]: ${payload.recomendacao || 'auditoria concluida.'}`;
  }
  if (route.skill === 'innovation-monitor' && payload?.reply) {
    return payload.reply;
  }
  if (route.skill === 'innovation-design' && payload?.reply) {
    return payload.reply;
  }
  if (route.skill === 'ecosystem-watch' && payload?.reply) {
    return payload.reply;
  }
  if (route.skill === 'innovation-test' && payload?.reply) {
    return payload.reply;
  }
  if (route.skill === 'schedule-whatsapp' && payload?.reply) {
    return payload.reply;
  }
  if (route.skill === 'schedule-whatsapp' && payload?.error) {
    return `WhatsApp: ${payload.error}`;
  }
  if (route.skill === 'user-preferences' && payload?.reply) {
    return payload.reply;
  }
  if (route.skill === 'proposals-pipeline' && payload?.reply) {
    return payload.reply;
  }
  if (
    (route.skill === 'whatsapp-send-contact' || route.skill === 'whatsapp-contacts') &&
    payload?.reply
  ) {
    return payload.reply;
  }
  if (
    (route.skill === 'whatsapp-send-contact' || route.skill === 'whatsapp-contacts') &&
    payload?.error
  ) {
    return `WhatsApp: ${payload.error}`;
  }
  if (route.skill === 'macofel-images-sync') {
    if (payload?.ok) {
      return `Sync OK: EAN ${payload.ean}, ${payload.urlCount} imagem(ns).`;
    }
    return `Sync falhou: ${payload?.error || 'erro desconhecido'}`;
  }
  if (route.skill === 'cursor-cloud-agent') {
    if (payload?.needsApproval && payload?.preview) {
      return `Cursor Cloud Agent — aprovação necessária.\n\n${payload.preview}\n\nResponda sim, confirmar ou ok.`;
    }
    if (payload?.reply) return payload.reply;
    if (payload?.agentUrl) {
      return `Cursor: ${payload.agentUrl}`;
    }
    if (payload?.error) return `Cursor: ${payload.error}`;
  }
  if (ORCHESTRATE_REPLY_AGENTS.has(route.agent) && payload) {
    return formatOrchestrateReply(route.agent, payload);
  }
  if (route.skill === 'help') {
    return [
      'Jarvis online — tens acesso a todo o ecossistema via Telegram.',
      '',
      'Operacao: /status (Macofel) · /office (agentes) · repos github · sites no ar · resumo portfolio',
      'Quotas LLM: /quotas ou rimuru status',
      'Inovacao: previsao de vendas (Yato→Gideon) · pesquisa mercado · viabilidade · design (Rebeca)',
      'Suporte: seguranca (Veldora) · testar agentes (Ícaro)',
      'WhatsApp: agendar whatsapp: data hora — texto · enviar joao "msg" amanhã 19h · contato adicionar nome +55… tipo',
      'Contactos: contato listar · lista agendamentos whatsapp',
      'Preferencias: preferencia listar · preferencia set quietHours 22:00-09:00',
      'Propostas: propostas · gerar proposta manutenção · aprovar proposta <id>',
      'Cursor: cursor: <tarefa> repo macofel — coding na nuvem (pede sim)',
    ].join('\n');
  }
  return 'Reformule o pedido. Ex.: status macofel, pesquisa mercado, tokens openrouter, resumo portfolio.';
}

const ORCHESTRATE_REPLY_AGENTS = new Set([
  'yato', 'gideon', 'hefestos', 'veldora', 'icaro',
]);

function formatOrchestrateSection(agentId, payload) {
  return formatOrchestrateReply(agentId, payload);
}

function formatOrchestrateReply(agentId, payload) {
  if (payload.ok === false) {
    if (payload.blockedBy === 'veldora' || payload.status === 403) {
      return `Veldora bloqueou ${agentId}: ${payload.error || payload.veldora?.reason || 'fonte nao autorizada'}`;
    }
    const hint = payload.hint || payload.error || 'servico indisponivel';
    if (payload.status === 503) {
      return `${agentId}: upstream nao configurado (${hint}).`;
    }
    return `${agentId}: falhou — ${hint}`;
  }
  const inner = payload.data ?? payload;
  const text =
    inner?.result
    ?? inner?.reply
    ?? inner?.message
    ?? (typeof inner === 'string' ? inner : null);
  if (text) return `${agentId}:\n${String(text).slice(0, 1200)}`;
  return `${agentId}: pedido encaminhado (ok).`;
}

function formatGithubRepoLine(r) {
  if (r.error) return `${r.name}: erro ${r.error}`;
  const push = r.pushed_at ? r.pushed_at.slice(0, 10) : '?';
  const label = r.name;
  return `${label}: ${r.open_issues} issues, ultimo push ${push}`;
}

function formatSiteLabel(key) {
  if (key === 'portal') return 'Portal (lwdigitalforge.com)';
  return key;
}

function sectionMacofel(data) {
  if (!data?.ok) return 'Macofel: indisponivel.';
  const p = data.pending_review ?? '?';
  const img = data.image_sync_pending ?? '?';
  return `Macofel: ${p} revisao, ${img} img pendente.`;
}

function sectionGithub(data) {
  if (!data?.repos) return 'GitHub: sem dados.';
  const lines = data.repos.map((r) => formatGithubRepoLine(r));
  return 'GitHub:\n' + lines.join('\n');
}

function sectionDeploy(data) {
  if (!data?.sites) return 'Sites: sem dados.';
  const lines = data.sites.map((s) =>
    s.ok ? `${formatSiteLabel(s.site)}: OK` : `${formatSiteLabel(s.site)}: FALHA`
  );
  return (data.ok ? 'Sites:\n' : 'Sites (atencao):\n') + lines.join('\n');
}

function sectionVpPecas(data) {
  if (!data?.sites) return 'VP-Pecas: sem dados.';
  const lines = data.sites.map((s) =>
    s.ok ? `${s.site}: OK` : `${s.site}: FALHA`
  );
  return (data.ok ? 'VP-Pecas:\n' : 'VP-Pecas (atencao):\n') + lines.join('\n');
}

/** Resposta agregada para workflows multi-step. */
export function buildWorkflowReply({ workflowId, results = {}, approvalBlocked = false }) {
  if (approvalBlocked && workflowId === 'macofel-sync') {
    const pre = results['macofel-status'];
    const head = pre?.ok ? sectionMacofel(pre) + '\n\n' : '';
    return (
      head +
      'Sync de imagens requer aprovacao. Responda sim, confirmar ou ok no Telegram.'
    );
  }

  if (workflowId === 'portfolio-status') {
    const parts = [
      sectionMacofel(results['macofel-status']),
      sectionGithub(results['github-aldebaran']),
      sectionDeploy(results['deploy-monitor']),
      sectionVpPecas(results['vp-pecas-health']),
    ];
    return parts.join('\n\n');
  }

  if (workflowId === 'agents-status') {
    const flow = results['ecosystem-watch'];
    const parts = [];
    if (flow?.reply) parts.push(flow.reply);
    else if (flow?.operational?.length) {
      parts.push(
        'Agentes:\n' +
          flow.operational
            .map((a) => `${a.id}: ${a.state}${a.skill ? ` (${a.skill})` : ''}`)
            .join('\n')
      );
    }
    parts.push(sectionDeploy(results['deploy-monitor']));
    parts.push(sectionGithub(results['github-aldebaran']));
    return parts.filter(Boolean).join('\n\n');
  }

  if (workflowId === 'vendas-previsao') {
    const parts = [];
    const yato = results['innovation-market'];
    const gideon = results['innovation-forecast'];
    if (yato) parts.push(`🧠 Yato · mercado\n${formatOrchestrateSection('yato', yato)}`);
    if (gideon) parts.push(`🧠 Gideon · previsão\n${formatOrchestrateSection('gideon', gideon)}`);
    return parts.length
      ? parts.join('\n\n')
      : 'Previsão de vendas: agentes sem resposta (HF/EC2 indisponível?).';
  }

  const chunks = Object.entries(results).map(([skill, data]) => {
    if (skill === 'macofel-status') return sectionMacofel(data);
    if (skill === 'github-aldebaran') return sectionGithub(data);
    if (skill === 'deploy-monitor') return sectionDeploy(data);
    if (skill === 'vp-pecas-health') return sectionVpPecas(data);
    if (skill === 'vercel-status') {
      if (!data?.projects) return 'Vercel: sem dados.';
      return (
        'Vercel:\n' +
        data.projects.map((p) => `${p.name}: ${p.latest?.state || '?'}`).join('\n')
      );
    }
    return `${skill}: executado.`;
  });
  return chunks.filter(Boolean).join('\n\n') || 'Workflow concluido.';
}
