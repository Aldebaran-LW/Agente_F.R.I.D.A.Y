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
    const lines = payload.repos.map((r) =>
      r.error ? `${r.name}: erro ${r.error}` : `${r.name}: ${r.open_issues} issues`
    );
    return 'GitHub:\n' + lines.join('\n');
  }
  if (route.skill === 'deploy-monitor' && payload?.sites) {
    const lines = payload.sites.map((s) =>
      s.ok ? `${s.site}: ${s.status} OK` : `${s.site}: FALHA`
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
      return `${p.name}: ${st}`;
    });
    return 'Vercel:\n' + lines.join('\n');
  }
  if (route.skill === 'macofel-images-sync') {
    if (payload?.ok) {
      return `Sync OK: EAN ${payload.ean}, ${payload.urlCount} imagem(ns).`;
    }
    return `Sync falhou: ${payload?.error || 'erro desconhecido'}`;
  }
  if (route.skill === 'help') {
    return 'Jarvis online. Diga: status macofel, repos github, sites no ar, vp-pecas, vercel, resumo portfolio.';
  }
  return 'Reformule o pedido. Ex.: status macofel, repos github, resumo portfolio.';
}

function sectionMacofel(data) {
  if (!data?.ok) return 'Macofel: indisponivel.';
  const p = data.pending_review ?? '?';
  const img = data.image_sync_pending ?? '?';
  return `Macofel: ${p} revisao, ${img} img pendente.`;
}

function sectionGithub(data) {
  if (!data?.repos) return 'GitHub: sem dados.';
  const lines = data.repos.map((r) =>
    r.error ? `${r.name}: erro` : `${r.name}: ${r.open_issues} issues`
  );
  return 'GitHub:\n' + lines.join('\n');
}

function sectionDeploy(data) {
  if (!data?.sites) return 'Sites: sem dados.';
  const lines = data.sites.map((s) =>
    s.ok ? `${s.site}: OK` : `${s.site}: FALHA`
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
