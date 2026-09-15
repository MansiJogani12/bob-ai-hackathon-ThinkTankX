-- ─────────────────────────────────────────────────────────────────────────────
-- YieldSentinel — Supabase migrations
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- analyses: one row per CSV upload per user
create table if not exists analyses (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users(id) on delete cascade,
  dataset_name       text        not null,
  created_at         timestamptz default now(),
  total_records      int,
  pass_count         int,
  fail_count         int,
  yield_percentage   float,
  fail_rate          float,
  prediction_summary jsonb,
  root_causes        jsonb,
  defect_patterns    jsonb,
  analysis_summary   jsonb,
  recommendations    jsonb,
  model_info         jsonb,
  metadata           jsonb
);

-- Enable RLS
alter table analyses enable row level security;

-- Drop old policy if exists, then recreate with correct syntax
drop policy if exists "own analyses" on analyses;

-- SELECT: users can read their own rows
create policy "analyses_select" on analyses
  for select using (auth.uid() = user_id);

-- INSERT: users can only insert rows where user_id = their own uid
create policy "analyses_insert" on analyses
  for insert with check (auth.uid() = user_id);

-- UPDATE: users can update only their own rows
create policy "analyses_update" on analyses
  for update using (auth.uid() = user_id);

-- DELETE: users can delete only their own rows
create policy "analyses_delete" on analyses
  for delete using (auth.uid() = user_id);


-- corrective_actions
create table if not exists corrective_actions (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users(id) on delete cascade,
  analysis_id          uuid        references analyses(id) on delete cascade,
  action_taken         text,
  date_taken           date,
  status               text        default 'OPEN',
  expected_improvement text,
  notes                text,
  recommendation_key   text,
  evidence_trigger     text,
  parameter            text,
  affected_records     int,
  failure_rate         float,
  risk_contribution    float,
  evidence_strength    float,
  equipment            text,
  validation_result    text,
  due_date             date,
  completed_at         timestamptz,
  created_at           timestamptz default now()
);

alter table corrective_actions add column if not exists recommendation_key text;
alter table corrective_actions add column if not exists evidence_trigger text;
alter table corrective_actions add column if not exists parameter text;
alter table corrective_actions add column if not exists affected_records int;
alter table corrective_actions add column if not exists failure_rate float;
alter table corrective_actions add column if not exists risk_contribution float;
alter table corrective_actions add column if not exists evidence_strength float;
alter table corrective_actions add column if not exists equipment text;
alter table corrective_actions add column if not exists validation_result text;
alter table corrective_actions add column if not exists due_date date;
alter table corrective_actions add column if not exists completed_at timestamptz;

alter table corrective_actions enable row level security;

drop policy if exists "own actions" on corrective_actions;

create policy "ca_select" on corrective_actions
  for select using (auth.uid() = user_id and exists (
    select 1 from analyses a where a.id = analysis_id and a.user_id = auth.uid()
  ));

create policy "ca_insert" on corrective_actions
  for insert with check (auth.uid() = user_id and exists (
    select 1 from analyses a where a.id = analysis_id and a.user_id = auth.uid()
  ));

create policy "ca_update" on corrective_actions
  for update using (auth.uid() = user_id and exists (
    select 1 from analyses a where a.id = analysis_id and a.user_id = auth.uid()
  ));

create policy "ca_delete" on corrective_actions
  for delete using (auth.uid() = user_id);


-- comparisons
create table if not exists comparisons (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  analysis_ids      uuid[]      not null,
  comparison_result jsonb,
  created_at        timestamptz default now()
);

alter table comparisons enable row level security;

drop policy if exists "own comparisons" on comparisons;

create policy "comp_select" on comparisons
  for select using (auth.uid() = user_id);

create policy "comp_insert" on comparisons
  for insert with check (auth.uid() = user_id);

create policy "comp_delete" on comparisons
  for delete using (auth.uid() = user_id);
