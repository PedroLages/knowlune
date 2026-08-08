-- Cleanup correction for legacy template rows whose empty course_id was
-- serialized as '' instead of NULL. The first protocol-v2 migration used a
-- strict NULL comparison and therefore intentionally deleted none of these
-- rows. This migration removes only the 31 rows matching template ID, path,
-- normalized course ID, and position; all other orphaned user rows remain.

BEGIN;

DELETE FROM public.learning_path_entries AS e
USING public.learning_path_template_entries AS t
WHERE e.id = t.id
  AND e.path_id IN (t.template_id, 'template_' || t.template_id)
  AND NULLIF(e.course_id, '') IS NOT DISTINCT FROM NULLIF(t.course_id, '')
  AND e.position = t.position;

COMMIT;
