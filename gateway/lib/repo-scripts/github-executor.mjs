/**
 * Executor GitHub — esqueleto (simula até aprovação real no pipeline).
 */

export async function createIssue(repo, title, body) {
  console.log('[github-stub] createIssue', { repo, title, body: String(body).slice(0, 120) });
  return {
    ok: true,
    simulated: true,
    issueUrl: `https://github.com/Aldebaran-LW/${repo}/issues/0-stub`,
    number: 0,
  };
}

export async function createPullRequest(repo, branch, changes = {}) {
  console.log('[github-stub] createPullRequest', { repo, branch, changes });
  return {
    ok: true,
    simulated: true,
    prUrl: `https://github.com/Aldebaran-LW/${repo}/pull/0-stub`,
  };
}

export async function executeProposedAction(proposal) {
  const action = proposal.proposedAction || 'create_github_issue';
  const repo = proposal.context?.repo || 'Agente_OpenClaw';

  if (action === 'create_github_issue' || action === 'hf_pipeline_then_github') {
    return createIssue(
      repo,
      proposal.title,
      `${proposal.description}\n\n---\nGerado por OpenClaw (simulado). ID: ${proposal.id}`
    );
  }

  console.log('[github-stub] executeProposedAction unknown', action);
  return { ok: false, error: `acao nao implementada: ${action}` };
}
