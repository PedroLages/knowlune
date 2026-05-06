ALTER TABLE public.learning_paths
  DROP COLUMN IF EXISTS cover_image_url,
  DROP COLUMN IF EXISTS cover_preset;
