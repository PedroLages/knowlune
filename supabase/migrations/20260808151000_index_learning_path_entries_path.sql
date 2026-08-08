-- Cover the protocol-v2 parent foreign key for efficient cascades and
-- parent-scoped downloads. Safe to run repeatedly in every environment.
CREATE INDEX IF NOT EXISTS learning_path_entries_path_id_idx
  ON public.learning_path_entries (path_id);
