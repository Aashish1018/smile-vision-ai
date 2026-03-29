-- Smile history persistence schema (append-only per scan_id)
create table if not exists public.smile_scans (
  id bigserial primary key,
  user_id uuid not null,
  scan_id text not null,
  created_at timestamptz not null default now(),
  overall_score int,
  simulation_type text,
  payload jsonb not null,
  constraint smile_scans_user_scan_unique unique (user_id, scan_id)
);

create index if not exists smile_scans_user_created_at_idx
  on public.smile_scans (user_id, created_at);

alter table public.smile_scans enable row level security;

create policy if not exists "Users can read their own smile history"
  on public.smile_scans
  for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their own smile history"
  on public.smile_scans
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can delete their own smile history"
  on public.smile_scans
  for delete
  using (auth.uid() = user_id);
