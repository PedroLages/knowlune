-- Repair legacy video_progress rows created before course_id was added.
-- The client needs [courseId+videoId] to write progress into Dexie.

BEGIN;

UPDATE public.video_progress AS progress
SET course_id = videos.course_id
FROM public.imported_videos AS videos
WHERE progress.course_id = ''
  AND progress.user_id = videos.user_id
  AND progress.video_id = videos.id::TEXT;

UPDATE public.video_progress AS progress
SET course_id = pdfs.course_id
FROM public.imported_pdfs AS pdfs
WHERE progress.course_id = ''
  AND progress.user_id = pdfs.user_id
  AND progress.video_id = pdfs.id::TEXT;

COMMIT;
