export function buildReply(route, payload, { approvalBlocked = false } = {}) {
  if (approvalBlocked) {
    return "Senhor, acao com impacto detectada. Aguardo sim, confirmar ou ok antes de executar.";
  }
  if (route.agent === "macofel" && payload?.ok) {
    const p = payload.pending_review ?? "?";
    const img = payload.image_sync_pending ?? "?";
    const fail = payload.image_sync_failed ?? "?";
    return `Macofel: ${p} em revisao, ${img} imagem pendente, ${fail} falha(s). (fonte: ${payload.source || "gateway"})`;
  }
  if (route.agent === "macofel" && !payload?.ok) {
    return "Nao consegui ler o catalogo Macofel.";
  }
  if (route.skill === "github-aldebaran" && payload?.repos) {
    const lines = payload.repos.map((r) =>
      r.error ? `${r.name}: erro ${r.error}` : `${r.name}: ${r.open_issues} issues`
    );
    return "GitHub:\n" + lines.join("\n");
  }
  if (route.skill === "deploy-monitor" && payload?.sites) {
    const lines = payload.sites.map((s) =>
      s.ok ? `${s.site}: ${s.status} OK` : `${s.site}: FALHA`
    );
    return (payload.ok ? "Sites OK.\n" : "Atencao:\n") + lines.join("\n");
  }
  if (route.skill === "help") {
    return "Jarvis online. Diga: status macofel, repos github, sites no ar.";
  }
  return "Reformule o pedido. Ex.: status macofel, repos github.";
}