-- E92-S01 Verification Script
-- Re-runnable SQL checks for AC1-AC7. Raises EXCEPTION on any failed assertion.
--
-- Usage (titan):
--   ssh titan docker exec -i supabase-db psql -U postgres -d postgres < supabase/tests/e92-s01-verify.sql
--
-- All test data created here uses the `e92s01-verify-*` prefix and is cleaned up at the end.
-- Idempotent — safe to re-run. Wraps in transactions per the `auth.uid()` lesson from the
-- story (set_config + RLS only works inside explicit BEGIN/COMMIT).
--
-- Coverage:
--   AC1  extensions present
--   AC2  tables + key constraints + generated column
--   AC3  RLS isolation (cross-user SELECT/UPDATE/DELETE all return 0 rows; anon no access;
--        service_role bypass is DOCUMENTED as expected/intentional — not tested here because
--        service_role is a trusted server-side role by design)
--   AC4  monotonic content_progress (status, progress_pct, updated_at)
--   AC5  monotonic video_progress (watched_seconds, duration_seconds)
--   AC6  idempotency — this script itself re-runs cleanly
--   AC7  no moddatetime trigger on content_progress / video_progress
--   +    Round-1 fixups: client_request_id uniqueness, _status_rank raises on unknown,
--        progress_pct=100 + in_progress CHECK rejects, future-pinned updated_at clamped,
--        last_position LWW actually updates

\set ON_ERROR_STOP on

-- ─── AC1: extensions ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_extension
      WHERE extname IN ('moddatetime','pgcrypto','vector','supabase_vault')) <> 4 THEN
    RAISE EXCEPTION 'AC1 FAIL: expected 4 extensions (moddatetime, pgcrypto, vector, supabase_vault)';
  END IF;
END $$;

-- ─── AC2: tables / columns / generated column ──────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='content_progress') THEN
    RAISE EXCEPTION 'AC2 FAIL: content_progress missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='study_sessions') THEN
    RAISE EXCEPTION 'AC2 FAIL: study_sessions missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='video_progress') THEN
    RAISE EXCEPTION 'AC2 FAIL: video_progress missing';
  END IF;
  -- watched_percent is generated
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='video_progress'
      AND column_name='watched_percent' AND is_generated='ALWAYS'
  ) THEN
    RAISE EXCEPTION 'AC2 FAIL: video_progress.watched_percent is not a generated column';
  END IF;
END $$;

-- ─── AC7: NO moddatetime trigger on progress tables ─────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname IN ('content_progress','video_progress')
    AND NOT t.tgisinternal;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC7 FAIL: expected 0 user triggers on progress tables, got %', v_count;
  END IF;
END $$;

-- ─── AC4/AC5: monotonic regressions (no users needed — functions use p_user_id) ─
-- Seed a pair of synthetic users in auth.users. If they already exist (re-run), reuse.
DO $$
DECLARE
  v_userA UUID := '00000000-0000-0000-0000-e92501000001';
  v_userB UUID := '00000000-0000-0000-0000-e92501000002';
BEGIN
  INSERT INTO auth.users (id, email, instance_id, aud, role)
  VALUES (v_userA, 'e92s01-verify-a@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (id, email, instance_id, aud, role)
  VALUES (v_userB, 'e92s01-verify-b@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- Clean any prior verify rows
  DELETE FROM public.content_progress WHERE content_id LIKE 'e92s01-verify-%';
  DELETE FROM public.video_progress  WHERE video_id   LIKE 'e92s01-verify-%';
  DELETE FROM public.study_sessions  WHERE user_id IN (v_userA, v_userB);

  -- AC4: status monotonicity (completed -> not_started keeps completed)
  PERFORM public.upsert_content_progress(v_userA, 'e92s01-verify-c1', 'course', 'completed', 100, now());
  PERFORM public.upsert_content_progress(v_userA, 'e92s01-verify-c1', 'course', 'not_started', 0, now());
  IF (SELECT status FROM public.content_progress
      WHERE user_id=v_userA AND content_id='e92s01-verify-c1') <> 'completed' THEN
    RAISE EXCEPTION 'AC4 FAIL: status regressed from completed';
  END IF;
  IF (SELECT progress_pct FROM public.content_progress
      WHERE user_id=v_userA AND content_id='e92s01-verify-c1') <> 100 THEN
    RAISE EXCEPTION 'AC4 FAIL: progress_pct regressed';
  END IF;

  -- AC4: updated_at older ignored
  PERFORM public.upsert_content_progress(v_userA, 'e92s01-verify-c2', 'course', 'in_progress', 50, now());
  PERFORM public.upsert_content_progress(v_userA, 'e92s01-verify-c2', 'course', 'in_progress', 50,
    now() - interval '1 day');
  IF (SELECT updated_at FROM public.content_progress
      WHERE user_id=v_userA AND content_id='e92s01-verify-c2') < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'AC4 FAIL: updated_at regressed to older value';
  END IF;

  -- AC5: watched_seconds monotonicity
  PERFORM public.upsert_video_progress(v_userA, 'e92s01-verify-v1', 500, 1000, now());
  PERFORM public.upsert_video_progress(v_userA, 'e92s01-verify-v1', 200, 1000, now());
  IF (SELECT watched_seconds FROM public.video_progress
      WHERE user_id=v_userA AND video_id='e92s01-verify-v1') <> 500 THEN
    RAISE EXCEPTION 'AC5 FAIL: watched_seconds regressed';
  END IF;

  -- Round-1 fixup: _status_rank raises on unknown
  BEGIN
    PERFORM public._status_rank('bogus');
    RAISE EXCEPTION 'FIXUP FAIL: _status_rank did not raise on unknown status';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'unknown status:%' THEN
      RAISE EXCEPTION 'FIXUP FAIL: _status_rank raised wrong error: %', SQLERRM;
    END IF;
  END;

  -- Round-1 fixup: CHECK progress_pct=100 + in_progress rejected
  -- Use direct INSERT (bypasses upsert's status coercion) to test the constraint itself.
  BEGIN
    INSERT INTO public.content_progress(user_id, content_id, content_type, status, progress_pct, updated_at)
    VALUES (v_userA, 'e92s01-verify-c3', 'course', 'in_progress', 100, now());
    RAISE EXCEPTION 'FIXUP FAIL: progress_pct=100 + in_progress should violate CHECK';
  EXCEPTION WHEN check_violation THEN
    NULL; -- expected
  END;

  -- Round-1 fixup: future-pinned updated_at is clamped
  PERFORM public.upsert_content_progress(v_userA, 'e92s01-verify-c4', 'course', 'in_progress', 10,
    now() + interval '100 years');
  IF (SELECT updated_at FROM public.content_progress
      WHERE user_id=v_userA AND content_id='e92s01-verify-c4') > now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'FIXUP FAIL: p_updated_at was not clamped';
  END IF;

  -- Round-1 fixup: last_position LWW actually progresses with newer writes
  PERFORM public.upsert_video_progress(v_userA, 'e92s01-verify-v2', 100, 1000, now() - interval '1 hour');
  PERFORM public.upsert_video_progress(v_userA, 'e92s01-verify-v2', 300, 1000, now());
  IF (SELECT last_position FROM public.video_progress
      WHERE user_id=v_userA AND video_id='e92s01-verify-v2') <> 300 THEN
    RAISE EXCEPTION 'FIXUP FAIL: last_position did not LWW-update to newer value';
  END IF;

  -- Round-1 fixup: study_sessions idempotent via client_request_id
  INSERT INTO public.study_sessions (user_id, started_at, duration_seconds, client_request_id)
  VALUES (v_userA, now(), 600, '11111111-1111-1111-1111-111111111111');
  BEGIN
    INSERT INTO public.study_sessions (user_id, started_at, duration_seconds, client_request_id)
    VALUES (v_userA, now(), 600, '11111111-1111-1111-1111-111111111111');
    RAISE EXCEPTION 'FIXUP FAIL: duplicate client_request_id should be rejected';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- expected
  END;
END $$;

-- ─── AC3: RLS isolation. Must run inside a single transaction per the
-- `auth.uid()` lesson (set_config is_local=true only applies for the current txn).
-- CRITICAL: seed userB rows FIRST (as service_role, which bypasses RLS) so the
-- cross-user assertions below are real tests. Without seeded userB rows, the
-- count/UPDATE/DELETE against `user_id = userB` would return 0 even if RLS were
-- disabled — a false pass. ──
BEGIN;
  -- Seed userB rows as service_role (bypasses RLS).
  SET LOCAL ROLE service_role;
  INSERT INTO public.content_progress (user_id, content_id, content_type, status, progress_pct, updated_at)
    VALUES ('00000000-0000-0000-0000-e92501000002', 'e92s01-verify-rls-b1', 'course', 'in_progress', 25, now())
    ON CONFLICT (user_id, content_id, content_type) DO NOTHING;
  INSERT INTO public.video_progress (user_id, video_id, watched_seconds, duration_seconds, last_position, updated_at)
    VALUES ('00000000-0000-0000-0000-e92501000002', 'e92s01-verify-rls-vb1', 100, 1000, 100, now())
    ON CONFLICT (user_id, video_id) DO NOTHING;
  INSERT INTO public.study_sessions (user_id, started_at, duration_seconds, client_request_id)
    VALUES ('00000000-0000-0000-0000-e92501000002', now(), 300, '22222222-2222-2222-2222-222222222222')
    ON CONFLICT (user_id, client_request_id) DO NOTHING;

  -- Switch to userA and assert RLS hides userB's rows.
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-e92501000001","role":"authenticated"}', true);

  -- userA sees only their rows
  DO $$
  DECLARE v_visible INT; v_cross INT;
  BEGIN
    SELECT count(*) INTO v_visible FROM public.content_progress
      WHERE user_id = '00000000-0000-0000-0000-e92501000001';
    IF v_visible = 0 THEN
      RAISE EXCEPTION 'AC3 FAIL: userA cannot see own rows';
    END IF;
    SELECT count(*) INTO v_cross FROM public.content_progress
      WHERE user_id = '00000000-0000-0000-0000-e92501000002';
    ASSERT v_cross = 0, 'RLS leak: userB content_progress rows visible to userA';

    SELECT count(*) INTO v_cross FROM public.video_progress
      WHERE user_id = '00000000-0000-0000-0000-e92501000002';
    ASSERT v_cross = 0, 'RLS leak: userB video_progress rows visible to userA';

    SELECT count(*) INTO v_cross FROM public.study_sessions
      WHERE user_id = '00000000-0000-0000-0000-e92501000002';
    ASSERT v_cross = 0, 'RLS leak: userB study_sessions rows visible to userA';

    -- Cross-user UPDATE should affect 0 rows (RLS filters before UPDATE).
    UPDATE public.content_progress SET progress_pct = 1
      WHERE user_id = '00000000-0000-0000-0000-e92501000002';
    GET DIAGNOSTICS v_cross = ROW_COUNT;
    ASSERT v_cross = 0, 'RLS leak: userA cross-user UPDATE affected rows';

    -- Cross-user DELETE should affect 0 rows.
    DELETE FROM public.content_progress
      WHERE user_id = '00000000-0000-0000-0000-e92501000002';
    GET DIAGNOSTICS v_cross = ROW_COUNT;
    ASSERT v_cross = 0, 'RLS leak: userA cross-user DELETE affected rows';
  END $$;
ROLLBACK;  -- discards the seeded userB rows; no cleanup needed

-- AC3: anon role has no access
BEGIN;
  SET LOCAL ROLE anon;
  DO $$
  DECLARE v INT;
  BEGIN
    SELECT count(*) INTO v FROM public.content_progress;
    IF v <> 0 THEN
      RAISE EXCEPTION 'AC3 FAIL: anon saw % content_progress rows (should be 0)', v;
    END IF;
    SELECT count(*) INTO v FROM public.video_progress;
    IF v <> 0 THEN
      RAISE EXCEPTION 'AC3 FAIL: anon saw % video_progress rows', v;
    END IF;
    SELECT count(*) INTO v FROM public.study_sessions;
    IF v <> 0 THEN
      RAISE EXCEPTION 'AC3 FAIL: anon saw % study_sessions rows', v;
    END IF;
  END $$;
ROLLBACK;

-- NOTE on service_role: `service_role` intentionally BYPASSES RLS by design
-- (Supabase admin/server key). This is expected behavior — service_role is only used
-- server-side from trusted contexts (edge functions, admin tooling). It is NOT tested
-- here because testing "bypass works" would be a tautology.

-- ─── AC6: idempotency — target objects exist exactly once ──────────────────
-- The full initial migration is not re-runnable by design (CREATE TABLE without
-- IF NOT EXISTS), but the fixup migration uses guarded patterns (IF NOT EXISTS
-- on columns, pg_constraint guards on constraints, CREATE OR REPLACE on funcs).
-- Assert each target object exists exactly once — catches accidental duplicates
-- from misapplied migrations.
DO $$
DECLARE v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM pg_constraint
    WHERE conname = 'content_progress_pct_status_consistent';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'AC6 FAIL: content_progress_pct_status_consistent count = % (expected 1)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_constraint
    WHERE conname = 'study_sessions_user_client_request_unique';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'AC6 FAIL: study_sessions_user_client_request_unique count = % (expected 1)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_proc
    WHERE proname = '_status_rank' AND pronamespace = 'public'::regnamespace;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'AC6 FAIL: public._status_rank count = % (expected 1)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_proc
    WHERE proname = 'upsert_content_progress' AND pronamespace = 'public'::regnamespace;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'AC6 FAIL: public.upsert_content_progress count = % (expected 1)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_proc
    WHERE proname = 'upsert_video_progress' AND pronamespace = 'public'::regnamespace;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'AC6 FAIL: public.upsert_video_progress count = % (expected 1)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_class
    WHERE relname IN ('content_progress','study_sessions','video_progress')
      AND relnamespace = 'public'::regnamespace AND relkind = 'r';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'AC6 FAIL: E92-S01 tables count = % (expected 3)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_sessions'
      AND column_name = 'client_request_id';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'AC6 FAIL: study_sessions.client_request_id count = % (expected 1)', v_count;
  END IF;
END $$;

-- ─── Cleanup ────────────────────────────────────────────────────────────────
DELETE FROM public.content_progress WHERE content_id LIKE 'e92s01-verify-%';
DELETE FROM public.video_progress  WHERE video_id   LIKE 'e92s01-verify-%';
DELETE FROM public.study_sessions  WHERE user_id IN (
  '00000000-0000-0000-0000-e92501000001',
  '00000000-0000-0000-0000-e92501000002'
);
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-e92501000001',
  '00000000-0000-0000-0000-e92501000002'
);

-- If we got here, all gates passed.
DO $$ BEGIN RAISE NOTICE 'E92-S01 verification: all gates PASSED'; END $$;
