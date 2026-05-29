-- OpenClaw Hub — Supabase central (projeto openclaw-hub / LW_Digital_Forge)
-- Executar no SQL Editor do Supabase ou via CLI: supabase db push
-- Acesso: apenas service_role no gateway Vercel (RLS sem políticas públicas)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Função updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pedidos de aprovação (sync Macofel, deploy, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid,
  agent_id text not null default 'orchestrator',
  action_type text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  requested_by text default 'telegram',
  channel text,
  peer_id text,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_requests_status_idx
  on public.approval_requests (status, created_at desc);

create index if not exists approval_requests_trace_idx
  on public.approval_requests (trace_id);

drop trigger if exists approval_requests_updated_at on public.approval_requests;
create trigger approval_requests_updated_at
  before update on public.approval_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Execuções Jarvis / workflows (audit)
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null unique,
  source text not null default 'gateway'
    check (source in ('gateway', 'ec2', 'hf', 'cron', 'script')),
  agent_id text default 'orchestrator',
  message_preview text,
  plan_kind text,
  workflow_id text,
  route_agent text,
  route_skill text,
  approval jsonb not null default '{}'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_runs_created_idx
  on public.workflow_runs (created_at desc);

create index if not exists workflow_runs_agent_idx
  on public.workflow_runs (agent_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Sessões Telegram / canal
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'telegram',
  peer_id text not null,
  agent_id text not null default 'orchestrator',
  context jsonb not null default '{}'::jsonb,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, peer_id)
);

create index if not exists conversation_sessions_last_idx
  on public.conversation_sessions (last_message_at desc);

drop trigger if exists conversation_sessions_updated_at on public.conversation_sessions;
create trigger conversation_sessions_updated_at
  before update on public.conversation_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Snapshots operacionais (office, macofel, github, deploy)
-- ---------------------------------------------------------------------------
create table if not exists public.snapshots (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('office', 'macofel', 'github', 'deploy', 'portfolio', 'custom')),
  payload jsonb not null,
  ok boolean,
  source text not null default 'gateway',
  created_at timestamptz not null default now()
);

create index if not exists snapshots_kind_created_idx
  on public.snapshots (kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Aprendizagens / notas dos agentes (HF, EC2, gateway)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_learnings (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  source text not null default 'gateway'
    check (source in ('gateway', 'ec2', 'hf', 'telegram', 'script')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_learnings_agent_idx
  on public.agent_learnings (agent_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — bloqueia anon/authenticated; service_role ignora RLS no Supabase
-- ---------------------------------------------------------------------------
alter table public.approval_requests enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.snapshots enable row level security;
alter table public.agent_learnings enable row level security;

-- View útil: último snapshot por kind
create or replace view public.latest_snapshots as
select distinct on (kind)
  kind,
  id,
  ok,
  source,
  payload,
  created_at
from public.snapshots
order by kind, created_at desc;
