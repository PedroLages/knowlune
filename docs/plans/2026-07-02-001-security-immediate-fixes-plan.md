# Plan: Apply Immediate Security Fixes (2026-07-02 Audit)

**TL;DR** — Fix three low-risk, high-impact findings from the security audit: remove user enumeration via signup error messages, add anon-key warnings to `.env.example`, and add a build-time guard preventing `DEV_SKIP_ENTITLEMENT=true` in production builds.

**Steps**

1. **Fix user enumeration in `useAuthStore.ts`** (*no dependencies*)
   - File: `src/stores/useAuthStore.ts`, function `mapSupabaseError`, line 40-41
   - Change `'This email is already registered. Try signing in instead.'` to a generic message like `'If this email is eligible for sign-up, a confirmation link will be sent.'`
   - Don't change the behavior for `/signIn` — only the `signUp` path leaks the "already registered" info. But since `mapSupabaseError` is shared, apply the generic message for both flows.

2. **Add anon key warning to `.env.example`** (*no dependencies, parallel with step 1*)
   - File: `.env.example`, line 8 (`VITE_SUPABASE_ANON_KEY=your_anon_key_here`)
   - Add a prominent comment block above the line warning self-hosters to NEVER put the service_role key here
   - Include a brief explanation that the anon key IS safe to expose to the browser and RLS enforces data access

3. **Add production build guard for `DEV_SKIP_ENTITLEMENT`** (*no dependencies, parallel with steps 1-2*)
   - File: `vite.config.ts`, inside the `ollamaDevProxy` plugin or as a top-level build-time check
   - Add a check: if `process.env.NODE_ENV === 'production'` (or `mode === 'production'` in Vite's `config` hook) AND `process.env.DEV_SKIP_ENTITLEMENT === 'true'`, throw an error that fails the build with a clear message
   - Use Vite's `config` hook with access to `mode` parameter for the mode check

**Relevant files**
- `src/stores/useAuthStore.ts:40-41` — `mapSupabaseError` function, user enumeration fix
- `.env.example:8` — Add warning comment about anon key vs service_role key
- `vite.config.ts:47-50` — Add production guard for DEV_SKIP_ENTITLEMENT

**Verification**
1. Run `npm run build` — build succeeds without DEV_SKIP_ENTITLEMENT flag
2. Set `DEV_SKIP_ENTITLEMENT=true` and run `npm run build` — build fails with clear error
3. Run existing auth unit tests — confirm error messages still map correctly
4. E2E: Sign up with an existing email — verify generic message appears
5. Read `.env.example` — verify warning is clear and prominent

**Scope boundaries**
- INCLUDES: Error message change, env file documentation, build guard
- EXCLUDES: Any backend/rate-limiting changes, CSP changes, Edge Function creation
