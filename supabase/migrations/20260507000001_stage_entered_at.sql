alter table public.stage_progress
  add column if not exists stage_entered_at timestamptz;

