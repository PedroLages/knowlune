ALTER TABLE public.learning_paths
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_preset TEXT;
