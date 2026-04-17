# OpenAI Code Review: E92-S01 (Supabase P0 SQL Migrations)
**Review Date**: 2026-04-17  
**Story**: E92-S01 — Supabase P0 Migrations and Extensions  
**Status**: ERROR (OpenAI API quota exceeded) — Fallback manual adversarial review provided

---

## Error Context

**OpenAI API Error**: `insufficient_quota` — API quota exhausted during review attempt.  
**Fallback**: Independent adversarial analysis conducted using SQL best-practices and PostgreSQL semantics.

---

## Findings (Adversarial Analysis)

### BLOCKER

#### 1. Duplicate `_status_rank()` Function Definition in R2 Fixup

**File**: `supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql`  
**Lines**: 54–89 (function defined TWICE)  
**Severity**: BLOCKER

**Issue**:
```sql
-- Lines 54-71: First definition (with ELSE NULL)
CREATE OR REPLACE FUNCTION public._status_rank(s TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN CASE s
    WHEN 'completed' THEN 3
    WHEN 'in_progress' THEN 2
    WHEN 'not_started' THEN 1
    ELSE NULL  -- <-- Returns NULL for unknown
  END;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'unknown status: %', s;
END;
$$;

-- Lines 74-89: Second definition (identical logic, explicit IF/ELSIF)
CREATE OR REPLACE FUNCTION public._status_rank(s TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
BEGIN
  IF s = 'completed' THEN RETURN 3;
  ELSIF s = 'in_progress' THEN RETURN 2;
  ELSIF s = 'not_started' THEN 1;
  ELSE
    RAISE EXCEPTION 'unknown status: %', s;
  END IF;
END;
$$;
```

The second `CREATE OR REPLACE` silently overwrites the first. While both have identical intent (raise on unknown), the duplication suggests authoring confusion. The presence of both in the same migration is a code smell — maintainers may not realize the first is discarded.

**Fix**: Remove lines 54–71. Keep only the explicit IF/ELSIF version (lines 74–89) with a clear comment:
```sql
-- Fix 9: _status_rank unknown/NULL guard
-- Replaces the original SQL version with an explicit raise-on-unknown implementation.
-- STRICT keyword ensures NULL input returns NULL (via short-circuit, not function execution).
-- Non-NULL unknown values explicitly RAISE EXCEPTION.
CREATE OR REPLACE FUNCTION public._status_rank(s TEXT) ...
```

**Confidence**: High (inspection of source code)

---

### HIGH

#### 2. RLS Policies Do Not Prevent Direct UPDATE/DELETE on Progress Tables

**File**: `supabase/migrations/20260413000001_p0_sync_foundation.sql`  
**Lines**: 62–67 (content_progress), 138–142 (video_progress)  
**Severity**: HIGH (design risk, not a bug)

**Issue**:
```sql
CREATE POLICY "Users access own content_progress"
  ON public.content_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

The `FOR ALL` policy applies the same check to SELECT, UPDATE, and DELETE. While this correctly enforces user isolation, it **does not prevent** a client from issuing `UPDATE content_progress SET status = 'xyz' ...` directly (bypassing the upsert function).

The story design assumes clients will:
1. Always call `upsert_content_progress()` (enforces monotonicity)
2. Never call UPDATE/DELETE directly

But there is no SQL-level enforcement — only a convention.

**Risk**: If a client developer accidentally calls `UPDATE`, or if a future admin script issues direct updates, monotonicity invariants (`GREATEST`, status rank) are bypassed.

**Recommendation**: 
- Document the assumption clearly in function headers: *"Clients MUST use these upsert functions; direct UPDATE/DELETE is unsupported and will corrupt invariants."*
- Consider adding explicit UPDATE/DELETE DENY policies if stricter enforcement is needed:
  ```sql
  CREATE POLICY "no_direct_update" ON content_progress FOR UPDATE USING (false);
  CREATE POLICY "no_direct_delete" ON content_progress FOR DELETE USING (false);
  ```
  (But this would break admin operations, so is a design tradeoff.)

**Confidence**: High

---

#### 3. Base Migration Missing `search_path` on `_status_rank()`

**File**: `supabase/migrations/20260413000001_p0_sync_foundation.sql`  
**Lines**: 154–165  
**Severity**: HIGH

**Issue**:
The original `_status_rank()` function is defined as SQL-IMMUTABLE without `SET search_path`:

```sql
CREATE OR REPLACE FUNCTION public._status_rank(s TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE s
    WHEN 'completed' THEN 3
    WHEN 'in_progress' THEN 2
    WHEN 'not_started' THEN 1
    ELSE 0
  END;
$$;
```

If a future schema/user has a different `search_path` (e.g., includes a custom `public` or `my_schema`), and someone defines their own `_status_rank()` function in a different schema, calls to `_status_rank()` from `upsert_content_progress()` might resolve to the wrong function.

**Fixed in R2**: The fixup migration adds `SET search_path = public, pg_temp` to all function definitions. This is correct, but the base migration is vulnerable in isolation.

**Risk**: If someone applies only `20260413000001` without `20260417000002`, the code is unsafe for multi-schema databases.

**Recommendation**: 
- Document that R2 fixup migration MUST follow the base migration.
- Consider adding `SET search_path = public, pg_temp` to the base migration directly (not as a fixup).

**Confidence**: High

---

### MEDIUM

#### 4. Timestamp Clamping Rationale Undocumented

**File**: `supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql`  
**Lines**: 107, 162  
**Severity**: MEDIUM

**Issue**:
```sql
v_clamped_updated_at TIMESTAMPTZ := LEAST(p_updated_at, now() + interval '5 minutes');
```

The functions clamp client-provided timestamps to a max of 5 minutes in the future. This guards against malicious or broken clients sending far-future timestamps. However:

1. **Edge case**: A legitimate client sending a timestamp from 1 hour ago will have that stale value used as `updated_at`. On the next sync, if another update arrives with a newer timestamp, it will override due to the `GREATEST()` logic. This is correct but unintuitive.

2. **Comment missing**: The migration lacks explanation of why the 5-minute clamp was chosen. Is it arbitrary? Based on typical network latency? Configurable per environment?

**Recommendation**: 
Add clarifying comment:
```sql
-- Clamp p_updated_at to [now(), now() + 5 minutes] to prevent malicious clients from
-- injecting far-future or far-past timestamps that corrupt LWW ordering. The 5-minute
-- buffer accounts for clock skew on client devices. GREATEST(...) in the ON CONFLICT
-- clause ensures monotonicity: older timestamps never overwrite newer ones.
v_clamped_updated_at TIMESTAMPTZ := LEAST(p_updated_at, now() + interval '5 minutes');
```

**Confidence**: High (common issue in distributed systems code)

---

#### 5. Progress Table Allows NULL Timestamp Parameters

**File**: `supabase/migrations/20260413000001_p0_sync_foundation.sql` (base)  
**Lines**: 169–176 (upsert_content_progress signature)  
**Severity**: MEDIUM

**Issue**:
The function parameter `p_updated_at TIMESTAMPTZ` is **not declared NOT NULL**. If called with NULL:

```sql
SELECT public.upsert_content_progress(uuid, 'abc', 'course', 'completed', 100, NULL);
```

The function will insert `NULL` into the `updated_at` column, violating the table's `NOT NULL` constraint:

```
ERROR:  null value in column "updated_at" violates not-null constraint
```

While this fails safely (prevents silent data corruption), it's a poor error message for API callers.

**Fix**: Add NOT NULL to the function signature:
```sql
CREATE OR REPLACE FUNCTION public.upsert_content_progress(
  p_user_id UUID,
  p_content_id TEXT,
  p_content_type TEXT,
  p_status TEXT,
  p_progress_pct INTEGER,
  p_updated_at TIMESTAMPTZ NOT NULL  -- <-- Add here
)
```

Or validate in the function body:
```sql
IF p_updated_at IS NULL THEN
  RAISE EXCEPTION 'p_updated_at cannot be NULL';
END IF;
```

**Confidence**: High

---

### MEDIUM (Continued)

#### 6. Generated Column Edge Case: `watched_seconds > duration_seconds`

**File**: `supabase/migrations/20260413000001_p0_sync_foundation.sql`  
**Lines**: 119–125  
**Severity**: MEDIUM (design question)

**Issue**:
The `watched_percent` generated column caps the result at 100%:

```sql
watched_percent NUMERIC(5, 2) GENERATED ALWAYS AS (
  CASE
    WHEN duration_seconds > 0
      THEN LEAST(100::numeric, (watched_seconds::numeric / duration_seconds) * 100)
    ELSE 0
  END
) STORED
```

If a client calls:
```sql
upsert_video_progress(uuid, 'vid1', 1200, 1000, now())  -- watched 1200s of 1000s
```

The `watched_seconds` column will be clamped to 1000 by the `GREATEST()` logic... wait, no:

```sql
watched_seconds = GREATEST(video_progress.watched_seconds, EXCLUDED.watched_seconds)
```

On INSERT, `watched_seconds` is set to 1200 directly (no clamping). Only on subsequent conflict do we GREATEST. So on first insert, `watched_seconds` can exceed `duration_seconds`, and `watched_percent` will correctly cap at 100.

**Actual behavior**: CORRECT (the LEAST() in the generated column ensures `watched_percent` never exceeds 100).

**No fix needed**, but the comment is worth adding:
```sql
-- Cap at 100% even if client sends watched_seconds > duration_seconds (happens in practice
-- when video duration is dynamically updated). LEAST() ensures range [0, 100].
```

**Confidence**: High

---

## Summary Table

| Severity | Count | Issues |
|----------|-------|--------|
| BLOCKER  | 1     | Duplicate `_status_rank()` definition in R2 fixup |
| HIGH     | 2     | RLS policies don't prevent direct UPDATE/DELETE; base migration missing `search_path` on `_status_rank()` |
| MEDIUM   | 3     | Timestamp clamp rationale undocumented; progress functions lack NOT NULL guard on timestamps; watched_percent edge case undocumented |
| LOW      | 0     | (None) |
| NIT      | 0     | (None) |

---

## Acceptance Criteria Verification

- **AC1** (Extensions): ✅ All 4 created with `IF NOT EXISTS`
- **AC2** (Tables/columns): ✅ All P0 tables present, schema matches plan
- **AC3** (RLS isolation): ✅ Policies enforce user isolation (design: UPDATE/DELETE via function only, not RLS-blocked)
- **AC4** (Monotonic content_progress): ✅ Status rank + GREATEST on pct/updated_at enforced
- **AC5** (Monotonic video_progress): ✅ GREATEST on watched/duration seconds, LWW on last_position (R2)
- **AC6** (Idempotency): ✅ IF NOT EXISTS and CREATE OR REPLACE used throughout; fixup migration guards with pg_constraint checks
- **AC7** (No moddatetime on progress tables): ✅ Verification script confirms 0 user triggers

---

## Gate Status

**Overall**: CONDITIONAL PASS (1 BLOCKER fix required)

- Fix the duplicate `_status_rank()` definition (lines 54–71 removal from R2)
- Address HIGH findings with documentation updates (RLS assumptions, search_path dependency)
- Optional: Add NOT NULL guards to function parameters for clearer error messages

After BLOCKER cleanup, the migration is production-ready and aligns with all AC.

---

**Report Generated**: Adversarial Manual Review (OpenAI API unavailable)  
**Reviewer**: Orion (SQL semantics, PostgreSQL best practices)  
**Confidence**: High (code inspection + story context)
