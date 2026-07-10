-- Context management (rolling summaries) — run in the Supabase SQL editor.
--
-- summary:                        rolling distilled summary of this thread's own messages
-- summarized_up_to_message_id:    last message covered by `summary` (ID anchor, not index)
-- inherited_summary:              frozen snapshot of the parent's summary at branch creation
-- inherited_summary_anchor_id:    parent message the snapshot covers up to (parent's anchor
--                                 at branch time); branch context sends parent messages
--                                 AFTER this anchor up to the fork point verbatim

alter table threads
  add column if not exists summary text,
  add column if not exists summarized_up_to_message_id uuid,
  add column if not exists inherited_summary text,
  add column if not exists inherited_summary_anchor_id uuid;
