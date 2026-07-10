-- Per-thread model attribution (branch compare) — run in the Supabase SQL editor.
-- When set, all streams in this thread use this provider/model instead of the
-- profile's active one. Set by "compare models" branch creation.

alter table threads
  add column if not exists provider text,
  add column if not exists model text;
