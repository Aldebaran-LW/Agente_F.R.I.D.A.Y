/** Catálogo MCP read-only — sem escrita, sem secrets na resposta. */
export const MCP_READ_TOOLS = [
  {
    name: 'macofel_status',
    description: 'Estado do catálogo Macofel (pendentes, imagens). Leitura only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'github_aldebaran',
    description: 'Status dos repos Aldebaran-LW no GitHub. Leitura only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'deploy_health',
    description: 'Health-check sites Macofel e portal LW Digital Forge.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'vercel_status',
    description: 'Últimos deployments Vercel dos projetos do portfólio.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'vp_pecas_health',
    description: 'Health-check sites VP-Pecas e vp-precision-studio.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'icaro_validate',
    description: 'Validação Ícaro — manifest vs executores gateway (gateway-lite).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'rimuru_quotas',
    description: 'Monitor quotas LLM e provedores (Rimuru). Leitura only.',
    inputSchema: {
      type: 'object',
      properties: {
        include_deploy: { type: 'boolean', description: 'Incluir deploy health (default true)' },
      },
      additionalProperties: false,
    },
  },
];

function asText(payload) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

export async function callMcpReadTool(name, args = {}) {
  switch (name) {
    case 'macofel_status': {
      const { fetchMacofelStatus } = await import('./macofel.mjs');
      return asText(await fetchMacofelStatus());
    }
    case 'github_aldebaran': {
      const { fetchGithubStatus } = await import('./github.mjs');
      return asText(await fetchGithubStatus());
    }
    case 'deploy_health': {
      const { fetchDeployHealth } = await import('./deploy.mjs');
      return asText(await fetchDeployHealth());
    }
    case 'vercel_status': {
      const { fetchVercelStatus } = await import('./vercel.mjs');
      return asText(await fetchVercelStatus());
    }
    case 'vp_pecas_health': {
      const { fetchVpPecasHealth } = await import('./vp-pecas.mjs');
      return asText(await fetchVpPecasHealth());
    }
    case 'icaro_validate': {
      const { runInnovationTest } = await import('./icaro.mjs');
      return asText(await runInnovationTest({ mode: 'gateway-lite' }));
    }
    case 'rimuru_quotas': {
      const { runInnovationMonitor } = await import('./rimuru.mjs');
      return asText(
        await runInnovationMonitor({ deploy: args.include_deploy !== false })
      );
    }
    default:
      throw new Error(`tool desconhecida ou não permitida: ${name}`);
  }
}
