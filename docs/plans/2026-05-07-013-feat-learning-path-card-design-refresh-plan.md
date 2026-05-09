---
title: "feat: Refresh learning path card design from Lumina reference + improve upload error diagnostics"
type: feat
status: active
date: 2026-05-07
origin: user-provided Lumina HTML design reference (not committed to repository)
---

# Refresh Learning Path Card Design from Lumina Reference + Improve Upload Error Diagnostics

## Overview

Update the `/learning-paths` card design to match a "Lumina" reference mockup (user-provided HTML design, not in repository) — taller gradient header, larger progress ring, more spacious content area, divider between description and footer, and refined button styling. Also improve cover image upload error messages with differentiated diagnostics so users and developers can identify what's failing without console access.

## Problem Frame

**Design:** The current card design differs from the Lumina reference in several ways: the gradient header is shorter (h-24 vs h-32), the progress ring is smaller (72px vs 80px) with smaller percentage text (text-xs vs text-lg — note: the reference uses text-xl but text-lg is chosen to avoid overflow in the 80px ring), content padding is tighter (px-4 vs px-6), there's no explicit divider between description and footer, and the action button is smaller (size="sm" vs px-6 py-2).

**Upload error:** Users report "Failed to upload cover image. Please try again." when saving a cover via PathCoverDialog. The upload code (at [src/lib/pathCoverUpload.ts](src/lib/pathCoverUpload.ts)) uses explicit insert with 409 Conflict retry and folder-prefix RLS policies (`{userId}/{pathId}.jpg`). The error is the generic message from the `else if (error)` branch at line 149 or from a failed remove+retry cycle in the 409 path. The root cause is unknown — either the RLS migration hasn't been deployed, the policies aren't matching, or there's a client-side processing failure (e.g., canvas toBlob returning null under memory pressure). Current error handling lumps all failures into one message. This plan adds differentiated error messages to identify the failure category — if the root cause is an undeployed RLS migration, a separate Supabase CLI deployment is needed; the improved diagnostics make this diagnosis possible from the toast alone.

## Requirements Trace

### Card Design Refresh

- R1. Card header is 128px tall (up from 96px), matching the Lumina reference `h-32`
- R2. Progress ring is larger (80px SVG), centered on the header/body seam, with 8px stroke width (matching reference), larger percentage text (`text-lg font-bold`), and light track color
- R3. Content area uses `px-6 pt-12` padding (up from `px-4 pt-8`), with a `<Separator />` between description and footer row. When path description is absent, the Separator still renders to maintain visual separation between the badge/title block and footer.
- R4. Card action button uses `px-6 py-2 rounded-xl text-sm font-bold` (pill-shaped with expand-on-hover via `group-hover:px-7`). Use `motion-safe:transition-[padding]` (not `transition-all`) for the expansion animation.
- R5. Card shadow is subtler (`shadow-sm hover:shadow-md motion-safe:transition-shadow motion-safe:duration-300`) and card has visible border
- R6. Card height increases to fit the taller header (128px) and larger ring (80px) while preserving usable content area — fixed pixel values determined by the new header + ring dimensions

### Cover Upload Error Diagnostics

- R7. Upload errors produce category-specific diagnostic messages: auth missing, unsupported format, canvas processing failure, 409 replace failure (remove failed), 409 replace failure (retry upload failed), network error, and generic storage error with sanitized Supabase message
- R8. Supabase Storage errors are logged to console with detail (status code, bucket name, masked key) for debugging; user-facing error messages use predefined safe text that does NOT expose internal schema/policy names
- R9. Upload interaction states follow the existing pattern: loading (button disabled + spinner), success (dialog closes + toast), error (dialog stays open + specific error toast)

## Scope Boundaries

- Card design refresh applies only to the `/learning-paths` list page — no other card surfaces (course cards, library cards, template cards) are changed
- Card design refresh uses existing Knowlune design tokens (from [src/styles/theme.css](src/styles/theme.css)), NOT the Lumina-specific colors (#0061C1, `bg-slate-100`, etc.)
- `PathProgressRing` component preserves its existing sm/md/lg API — the design change adjusts which size is used on learning path cards specifically
- `PathCardHeader` component, `PathCard` (inline in LearningPaths.tsx), `PathCardSkeleton` (inline in LearningPaths.tsx), and `PathProgressRing` (API extension only) are the only files changed for design
- Cover upload fix adds diagnostics but does NOT change the upload pipeline (image processing, key structure, RLS approach) — those were validated in prior plan 2026-05-07-012
- Cover upload fix does NOT create new storage buckets or RLS policies — the migration (`20260507000001_learning_path_cover_storage_policies.sql`) already covers that

### Deferred to Separate Tasks

- Dark mode gradient tweaks for the new card design: test and adjust in follow-up. Note: PathCardHeader gradient colors (`from-cyan-400 to-blue-600`, etc.) are hardcoded Tailwind classes, not design tokens — the taller h-32 header increases the dark mode surface area where these may look wrong. Potential follow-up work includes tokenizing gradient stops as CSS custom properties with dark mode variants.
- Touch device hover behavior on learning path cards: existing `@media(hover:none)` patterns in codebase can be applied in a follow-up
- Migrating old flat-path covers (`{pathId}.jpg`) to the new folder-prefix convention (`{userId}/{pathId}.jpg`): dev-only concern, no user impact

## Context & Research

### Relevant Code and Patterns

- **PathCard** (inline) in [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx:108-326) — card component with header, progress ring, body, footer
- **PathCardHeader** in [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx) — currently `h-24`; needs to become `h-32`
- **PathProgressRing** in [src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx) — three sizes: sm (48px), md (72px), lg (96px); the 80px ring from Lumina sits between md and lg
- **PathCardSkeleton** in [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx:330-352) — must mirror all positioning/sizing changes to avoid layout shift during loading
- **uploadPathCover** in [src/lib/pathCoverUpload.ts](src/lib/pathCoverUpload.ts) — client-side processing + Supabase Storage upload; error messages are generic
- **PathCoverDialog** in [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx) — save handler calls uploadPathCover, catches errors, shows toast
- **Design tokens** in [src/styles/theme.css](src/styles/theme.css) — `--card`, `--border`, `--muted-foreground`, `--brand`, `--content-gap`, etc.
- **Separator** in [src/app/components/ui/separator.tsx](src/app/components/ui/separator.tsx) — shadcn/ui Separator component, already imported in PathCoverDialog

### Institutional Learnings

- **Progress ring sizing tradeoff** (from [docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md)): The 48px ring was chosen over 72px to avoid content overlap in the fixed-height card. With a taller card (from taller header), the larger ring becomes viable without content compression.
- **Skeleton mirroring** (same doc): Skeleton must match real ring position exactly to prevent layout shift during loading.
- **Transform-based positioning** (from [docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md](docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md)): `top-0 -translate-y-1/2` self-centers the ring on the header/body seam regardless of ring size — preferred over magic-pixel offsets that break when ring dimensions change.
- **Storage RLS folder-prefix convention** (same doc): `(storage.foldername(name))[1] = auth.uid()::text` — already applied. The migration `20260507000001` creates the bucket and policies.
- **statusCode type coercion** (commit `9b209252`): `Number(error?.statusCode) === 409` handles both string and number formats from Supabase SDK.
- **Cover dialog mutual exclusion** (from [docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md](docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md)): Selecting a gradient clears upload; selecting an upload clears gradient preset.

### External References

- Lumina design reference: user-provided HTML mockup (not committed to repository; design specifications are captured in this plan's Requirements Trace section)

## Key Technical Decisions

- **80px ring via PathProgressRing prop extension**: Rather than changing the md size globally (which would affect other consumers), extend `PathProgressRing` to accept `size` as a `number` in addition to the existing string presets. Alternative considered: adding a fourth named preset (`xl: 80`) — rejected because a numeric override requires the same amount of code (one typeof check) and is more flexible for future one-off sizes. The auto-fontSize internal heuristic (shown in the Unit 3 technical design) is guidance only — the PathCard passes explicit `children` with its own `className`, so the internal heuristic is never exercised by this consumer.
- **8px stroke width on PathProgressRing matches the HTML reference's bold ring**: The HTML reference uses `stroke-width="8"` on a 100x100 viewBox, creating a prominently visible progress ring. PathProgressRing currently hardcodes 3px stroke. Adding an optional `strokeWidth` prop (defaulting to the current config value for backward compatibility) allows the learning path cards to pass `strokeWidth={8}` while leaving other consumers unaffected. This follows the exact pattern already established by `library/ProgressRing` (`strokeWidth` default 8) and `figma/ProgressRing` (`strokeWidth` default 4). At 80px ring size with 8px stroke, the inner radius is 32px (circumference ≈ 201), giving a stroke-to-ring ratio of ~10% that visually matches the reference.
- **Use shadcn Separator for the divider**: The reference uses `<hr>` but Knowlune has a `<Separator />` component (already imported elsewhere). Use Separator for consistency with the design system — it renders an `<hr>` internally with `border-border` styling. The Separator renders unconditionally even when `path.description` is absent, preserving the visual separation between badge/title and footer (matching the current `border-t` behavior).
- **Keep overflow-hidden on Card**: Required for `rounded-2xl` corner clipping. The ring badge extends above the header/body seam but stays within card bounds — verified in plan 2026-05-07-012.
- **Sanitization boundary for Supabase errors**: Supabase Storage error messages may contain internal schema references (policy names, table names). These are logged to console with full detail for debugging but sanitized before reaching user-facing toasts. User-facing messages use predefined safe text per failure category. This follows the principle from plan 2026-05-07-012: "Internal configuration details are logged for operators, not surfaced to end users."
- **Design + diagnostics bundled intentionally**: The design refresh (Units 2-5) and upload diagnostics (Unit 1) touch different files (except LearningPaths.tsx which both modify). They are bundled because the user reported both issues together and the combined work is small enough for a single PR. If either half needs reversion, the other can ship independently via cherry-pick.
- **Design token adaptation**: The Lumina reference uses `#0061C1` (Apple blue) and `bg-slate-100`. These are NOT used — instead map to existing design tokens: brand actions use `variant="brand"`, muted backgrounds use `bg-muted`, text uses `text-muted-foreground`, etc.
- **motion-safe: prefix on all new transitions**: Following WCAG 2.3.3 (the project's own design-review checklist requires `prefers-reduced-motion` respect), all new CSS transitions added in this plan use the `motion-safe:` prefix so they are disabled when the user has `prefers-reduced-motion: reduce` set.

## Implementation Units

- [x] **Unit 1: Add diagnostic error messages to uploadPathCover**

**Goal:** Replace the single generic "Failed to upload cover image" error with differentiated messages that identify what failed, enabling the user (and developer) to diagnose the upload issue without console access.

**Requirements:** R7, R8, R9

**Dependencies:** None

**Files:**
- Modify: `src/lib/pathCoverUpload.ts`

**Approach:**
- Create a typed error class or map of error messages keyed by failure category — no new dependency, a simple const enum or string map is sufficient:
  - Auth failure: "Sign in required to upload covers" (getUserId throws)
  - Format validation: "Unsupported image format. Use JPEG, PNG, or WebP." (already exists)
  - Canvas processing failure: "Could not process this image. Try a different file."
  - 409 remove failure: "Failed to replace existing cover. Please try again." (with console log of the remove error)
  - 409 retry upload failure: "Cover upload failed after clearing old cover. Please try again." (with console log of the retry error)
  - Generic storage error: "Cover upload failed. Check your connection and try again." (always use this safe fallback for user-facing message; do NOT expose raw Supabase error.message in the toast since it may contain internal schema/policy names)
  - Network/fetch failure: "Network error during upload. Check your connection."
- **Sanitization boundary:** Log the full Supabase `error.message`, `statusCode`, bucket name, and key to console via `console.error('[PathCoverUpload] ...')` for developer debugging. But thrown Error `.message` values (which reach `toast.error()` via PathCoverDialog's catch) MUST use only the predefined safe messages. This prevents internal schema details (RLS policy names, table names) from appearing in user-visible toasts.
- Log structured diagnostics: bucket name, key prefix (mask full userId and pathId: use `${userId.slice(0,8)}.../${pathId.slice(0,8)}...`), status code, and raw error message.
- The existing `getUserId()` already throws "Authentication required to upload covers" — improve to "Sign in required to upload covers" for user-facing clarity.
- The `!supabase` guard at the top of `uploadPathCover` (line 105-107) throws `"Supabase client is not available. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."` which exposes internal configuration details (env var names). Per R8 (sanitization), change this to a safe generic message: `"App configuration error. Check your connection and try again."` This maps to the "generic storage error" category.
- **Error routing for internal helpers:** The internal helper functions `loadImageFile` (rejects `"Failed to load image file"` on decode failure, `"Failed to read image file"` on FileReader failure) and `resizeToJpegBlob` (rejects `"Canvas context unavailable"` when 2D context is null, `"Canvas toBlob returned null"` when JPEG encoding fails) throw errors that are not caught by the existing Supabase error branches (lines 133-152 in the current code). These propagate directly to `PathCoverDialog.handleSave`'s catch block (line 116-118) which would show the raw internal message in a toast. To remap every internal error to a user-facing diagnostic:
  1. Wrap the image-processing block (`await loadImageFile(file)`, `await resizeToJpegBlob(img, COVER_W, COVER_H)`) in a try/catch inside `uploadPathCover`, after the file-type validation check but before the Supabase upload block.
  2. In the catch, log the original error with `console.error('[PathCoverUpload] Image processing failed:', err)` and throw `new Error('Could not process this image. Try a different file.')`.
  3. This maps all four internal processing error paths (reader read failure, image decode failure, canvas context unavailable, toBlob returned null) to the single "Canvas processing failure" diagnostic message.
  4. The `getUserId()` throw and `!supabase` guard occur before the image-processing block and are NOT caught by this wrapper — they propagate directly with their own improved messages.
- **Defense-in-depth for thrown network errors:** `supabase.storage.from().upload()` normally returns `{ data, error }` and does not throw. However, exceptional cases (browser extension interference, CSP violations, abrupt disconnection) can cause the underlying fetch to throw. To catch these:
  1. Wrap the Supabase upload block (the `upload()` call, 409 remove+retry logic, and the `else if (error)` branch) in an outer try/catch.
  2. In the catch, log the error with `console.error('[PathCoverUpload] Network error during upload:', err, { bucket: BUCKET_NAME, key: maskedKey })` and throw `new Error('Network error during upload. Check your connection.')`.
  3. This maps any truly thrown Supabase/fetch error to the "Network/fetch failure" diagnostic.
- **Complete error path inventory:** After these changes, every internal error path maps to exactly one user-facing diagnostic message:
  | Internal error point | Current message | Maps to diagnostic |
  | --- | --- | --- |
  | `!supabase` guard (line 105) | `"Supabase client is not available. Configure VITE_SUPABASE_URL..."` | `"App configuration error. Check your connection and try again."` (generic storage category) |
  | `getUserId()` (line 86) | `"Authentication required to upload covers"` | `"Sign in required to upload covers"` (auth failure) |
  | File type validation (line 115) | `"Unsupported image format. Use JPEG, PNG, or WebP."` | Unchanged (already correct) |
  | `loadImageFile` — reader.onerror (line 27) | `"Failed to read image file"` | Caught by image-processing wrapper → `"Could not process this image. Try a different file."` (canvas processing failure) |
  | `loadImageFile` — img.onerror (line 24) | `"Failed to load image file"` | Caught by image-processing wrapper → `"Could not process this image. Try a different file."` |
  | `resizeToJpegBlob` — ctx null (line 44) | `"Canvas context unavailable"` | Caught by image-processing wrapper → `"Could not process this image. Try a different file."` |
  | `resizeToJpegBlob` — toBlob null (line 68) | `"Canvas toBlob returned null"` | Caught by image-processing wrapper → `"Could not process this image. Try a different file."` |
  | 409 remove failure (line 137) | `"Failed to upload cover image. Please try again."` | `"Failed to replace existing cover. Please try again."` |
  | 409 retry upload failure (line 147) | `"Failed to upload cover image. Please try again."` | `"Cover upload failed after clearing old cover. Please try again."` |
  | Non-409 Supabase error (line 151) | `"Failed to upload cover image. Please try again."` | `"Cover upload failed. Check your connection and try again."` (generic, sanitized) |
  | Thrown network/fetch error | (propagates raw) | Caught by outer try/catch → `"Network error during upload. Check your connection."` |
- Do NOT change the upload pipeline, key structure, or RLS approach — those are correct per plan 2026-05-07-012.

**Patterns to follow:**
- Existing error throwing pattern in the same file — just add specificity to messages
- Existing `console.error('[PathCoverUpload] ...', ...)` pattern — extend with structured info

**Test scenarios:**
- Happy path: Upload succeeds, no error message shown (unchanged behavior)
- Error path: Auth missing → toast shows "Sign in required to upload covers"
- Error path: Invalid file type → toast shows "Unsupported image format..."
- Error path: Canvas toBlob returns null → toast shows "Could not process this image..."
- Error path: Storage returns non-409 error → toast shows safe generic "Cover upload failed. Check your connection and try again." (Supabase error detail logged to console only, not exposed in toast)
- Error path: 409 remove fails → toast shows "Failed to replace existing cover..."
- Error path: Network failure during fetch → toast shows "Network error during upload..."
- Integration: Console.error logs include bucket, key prefix, statusCode for all storage failures

**Verification:**
- On `/learning-paths`, open Change Cover, select an image, press Save — if upload fails, the toast shows a specific error message (not the generic "Failed to upload cover image")

---

- [x] **Unit 2: Increase card header height and adjust card dimensions**

**Goal:** Make the gradient/cover header taller (128px, up from 96px) and adjust the card's overall height to accommodate the taller header and larger progress ring.

**Requirements:** R1, R6

**Dependencies:** None (all target values are predetermined — header: 128px, ring: 80px, card: 360-380px. Can execute in parallel with Unit 3.)

**Files:**
- Modify: `src/app/components/figma/PathCardHeader.tsx`
- Modify: `src/app/pages/LearningPaths.tsx` (PathCard and PathCardSkeleton)

**Approach:**
- In `PathCardHeader`, change `h-24` to `h-32` on the outer `<div>` (line 83). This is a single-class change.
- In `PathCard` (LearningPaths.tsx), the Card has `h-[320px] md:h-[340px]`. The header is growing by 32px (96→128). The card height should increase proportionally — change to `h-[360px] md:h-[380px]` (~40px increase to also accommodate the larger progress ring from Unit 3).
- In `PathCardSkeleton`, change the placeholder header from `h-24` to `h-32` (line 333) and the card height to match.
- The CardContent uses `h-[calc(100%-6rem)]` — 6rem = 96px, matching current h-24 header. Update to `h-[calc(100%-8rem)]` (8rem = 128px) to match the new h-32 header.
- In `PathCardSkeleton`, update the skeleton's inner `h-24` to `h-32` (the gradient placeholder).

**Patterns to follow:**
- Existing `h-24` usage in PathCardHeader — single class change
- Existing fixed-height card pattern in PathCard — proportional adjustment

**Test scenarios:**
- Visual: Card header extends 128px on desktop (1440px), tablet (768px), mobile (375px)
- Visual: Card overall height is ~380px, content area has enough room for title + description + footer
- Visual: Skeleton matches live card dimensions exactly (no layout shift on load)
- Visual: Cover image fills the full 128px header (object-cover)

**Verification:**
- `/learning-paths` at all breakpoints — card headers are visibly taller, card proportions look balanced

---

- [ ] **Unit 3: Update progress ring size, typography, positioning, and stroke width**

**Goal:** Use a larger 80px progress ring with bolder 8px stroke (matching the HTML reference), bigger percentage text, and ensure positioning stays centered on the header/body seam.

**Requirements:** R2

**Dependencies:** None (all target values are predetermined — header: 128px, ring: 80px, card: 360px-380px. Can execute in parallel with Unit 2.)

**Files:**
- Modify: `src/app/components/figma/PathProgressRing.tsx`
- Modify: `src/app/pages/LearningPaths.tsx` (PathCard)

**Approach:**

Phase 1 (already done — commit d00472b4): Extended PathProgressRing with numeric `size` prop, set `size={80}` in PathCard, updated skeleton ring placeholder to 96px badge.

Phase 2 (remaining — the stroke width gap): Add optional `strokeWidth` prop to PathProgressRing that overrides the default stroke from the SIZES config. When provided, use it for both the background track and progress arc circles, and adjust radius computation accordingly (`radius = (size - strokeWidth * 2) / 2`). This follows the exact pattern from `library/ProgressRing` (which already accepts `strokeWidth`, defaulting to 8) and `figma/ProgressRing` (which accepts `strokeWidth`, defaulting to 4).

- Add `strokeWidth?: number` to the `PathProgressRingProps` interface.
- In the config resolution: when `strokeWidth` is provided, override `config.stroke` (currently hardcoded per size preset: sm=3, md=3, lg=4, numeric=3).
- Recompute `radius` and `circumference` using the resolved `config.stroke` — the existing formulas already use `config.stroke` so they're correct.
- In PathCard, pass `strokeWidth={8}` alongside `size={80}` to match the HTML reference. The reference uses 8px stroke with r=42 on a 100x100 viewBox, giving a bold, prominent ring.
- **Ring positioning:** Match the HTML reference's `-top-10` offset (40px above content top) instead of the current `-translate-y-1/2`. For the 96px ring badge (80px ring + p-2 * 2), `-top-10` places the ring center 8px below the header/body seam — the HTML specifically chose this offset. Update the ring container from `top-0 -translate-y-1/2` to `-top-10`:

**Technical design:**

> *Directional guidance, not implementation specification.*

```
PathProgressRing API extension:
  strokeWidth?: number  // overrides default stroke per size preset

Config resolution (order of precedence):
  1. strokeWidth prop if provided
  2. SIZES[preset].stroke if string preset
  3. default 3 for numeric sizes

When size=N (number) and strokeWidth=S:
  radius = (N - S * 2) / 2
  circumference = 2 * Math.PI * radius
  SVG viewBox = `0 0 ${N} ${N}`

At size=80, strokeWidth=8:
  radius = (80 - 16) / 2 = 32
  circumference = 2 * π * 32 ≈ 201.06
  // Note: HTML reference uses r=42 (circumference ~263.9) with 8px stroke on 100x100 viewBox.
  // At 80px with 8px stroke, r=32 keeps the ring within bounds.
  // The visual proportion (stroke-to-ring ratio) is what matters — 8px is ~10% of 80px.
```

**Patterns to follow:**
- HTML reference positioning: `absolute left-6 -top-10` on the ring badge container (80px ring + p-2 = 96px badge, `-top-10` = -40px offset). This places the ring slightly into the content area for visual integration.
- `library/ProgressRing` (`src/app/components/library/ProgressRing.tsx`) — already has `strokeWidth` prop with default 8. Follow the same pattern: optional prop, used in `radius` calculation and both circle `strokeWidth` attributes.
- `figma/ProgressRing` (`src/app/components/figma/ProgressRing.tsx`) — already has `strokeWidth` prop with default 4.
- Existing `SIZES` constant and size lookup in PathProgressRing — extend, don't replace.

**Test scenarios:**
- Visual: 80px ring with 8px stroke is bold and prominent, matching the HTML reference
- Visual: Percentage text at `text-lg font-bold` inside the ring, readable against the thicker ring
- Edge case: 0% progress — muted ring at 80px with 8px stroke, correctly positioned
- Edge case: 100% progress — green ring with CheckCircle2 icon, centered
- Edge case: `strokeWidth` not passed — uses default from SIZES config (backward compatible)
- Edge case: `strokeWidth={3}` with `size="sm"` — preset size with custom stroke
- Accessibility: ARIA progressbar still announces percentage correctly

**Verification:**
- `/learning-paths` at all breakpoints — ring has bold 8px stroke matching the HTML reference, centered on seam, no clipping, text is readable

---

- [x] **Unit 4: Update card layout — padding, divider, shadow, and border**

**Goal:** Match the Lumina reference's more spacious content area with explicit divider, subtler card shadow, and visible border.

**Requirements:** R3, R5

**Dependencies:** Unit 2 (card height)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx` (PathCard only)

**Approach:**
- Change CardContent padding from `px-4 pb-4 pt-8` to `px-6 pb-5 pt-12`. The increased top padding (pt-12 vs pt-8) accommodates the larger ring's lower half. The horizontal padding matches the reference's `p-6` (24px all sides).
- Add a `<Separator />` between the description paragraph and the footer row, replacing the current `border-t border-border pt-4` on the footer `<div>`. The Separator already uses `border-border`. The Separator renders unconditionally — even when `path.description` is absent, it provides visual separation between the badge/title block and footer (consistent with current `border-t` behavior). Pattern:
  ```
  {path.description && (
    <p className="... line-clamp-2 mb-4">{path.description}</p>
  )}
  <Separator className="mb-4" />
  <div className="flex items-center justify-between">
  ```
- Update PathCardSkeleton to match: change CardContent padding to `px-6 pb-5 pt-1` and replace the footer's `border-t border-border` with a separator placeholder (a `bg-border h-px` div matching Separator's visual output).
- Card shadow: Change from `hover:shadow-xl` to `shadow-sm hover:shadow-md motion-safe:transition-shadow motion-safe:duration-300`. Use `motion-safe:` prefix so the transition is disabled when `prefers-reduced-motion: reduce` is set (WCAG 2.3.3 compliance).
- Card border: The shadcn Card component already includes `border border-border` by default via the `Card` primitive. Verify this is visible. If not, ensure the Card className doesn't override it.
- Remove `transition-all` on the Card (too broad — transitions everything including layout properties). Replace with `motion-safe:transition-shadow motion-safe:duration-300` for the shadow hover only.

**Patterns to follow:**
- `Separator` component from [src/app/components/ui/separator.tsx](src/app/components/ui/separator.tsx) — already imported in PathCoverDialog
- Existing Card className pattern — adjust, don't replace completely

**Test scenarios:**
- Visual: Content has 24px horizontal padding, description-to-footer gap is clear
- Visual: Separator line visible between description and footer
- Visual: Card has visible border in both light and dark modes
- Visual: Card shadow is subtle at rest, increases slightly on hover (not a dramatic lift)
- Visual: Shadow transition is smooth (300ms, shadow only)

**Verification:**
- `/learning-paths` — cards look more spacious, divider is visible, shadow behavior is subtler

---

- [x] **Unit 5: Update footer button and thumbnail styling**

**Goal:** Make the action button larger and pill-shaped, with expand-on-hover animation matching the Lumina reference.

**Requirements:** R4

**Dependencies:** Unit 4 (layout changes affect the footer area)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx` (PathCard only)

**Approach:**
- In the `PathCard` footer, change the Button from `size="sm"` to `size="default"` with explicit padding `className="px-6 py-2 rounded-xl text-sm font-bold group-hover:px-7 motion-safe:transition-[padding]"`. The `motion-safe:` prefix ensures the expansion animation respects `prefers-reduced-motion` (WCAG 2.3.3). The `group-hover:px-7` creates the expand-on-hover effect (Lumina reference pattern). The Card already has `group` class.
- The `aria-label` on the button already includes the course name for accessibility — keep this.
- For the "Review" button (variant "outline"), apply the same `rounded-xl` and larger padding. The expand-on-hover should also apply.
- For the "Not Started" label (when footerAction is null and isNotStarted), keep the existing `text-xs font-bold text-muted-foreground uppercase` but add `px-2` for alignment.
- For the arrow-only fallback (neither isNotStarted nor footerAction), keep the existing `<ArrowRight>` icon but increase from `size-4` to `size-5` for better visual weight.
- Course thumbnail avatars: keep `size-8` (32px) — already matches the reference's `h-8 w-8`.

**Patterns to follow:**
- Existing `handleFooterClick` and `footerAction` structure — only styling changes
- Lumina reference: `bg-lumina-primary hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-bold` with `group-hover:px-7 transition-all`

**Test scenarios:**
- Happy path: In-progress path shows "Continue" button at larger size, pill-shaped (rounded-xl)
- Happy path: Button expands slightly on card hover (group-hover:px-7)
- Happy path: Unstarted path shows "Start" button at same larger size
- Happy path: Completed path shows "Review" button (outline variant, same sized layout)
- Happy path: Not-started path still shows "Not Started" text (no button change needed beyond alignment)
- Edge case: Long button text doesn't overflow the card at the new larger size
- Accessibility: aria-label on button still contains full course name for screen readers

**Verification:**
- `/learning-paths` — buttons are pill-shaped, larger, and expand on card hover
- All button states (Continue/Start/Review/Not Started) are consistent in sizing

## System-Wide Impact

- **Interaction graph:** `PathCard` (inline) → `PathCardHeader` + `PathProgressRing` + `CardContent`. Only the list page card is changed — `PathProgressRing` API extends backward-compatibly, and other consumers (if any) are unaffected. `PathCardHeader` preserves its existing prop interface; only internal styling changes.
- **Error propagation:** After Unit 1, upload errors carry specific diagnostics. `PathCoverDialog.handleSave` already catches errors and shows toasts — no change needed there.
- **State lifecycle risks:** No new state mutations. Ring sizing is a prop change. Card height is a static CSS change.
- **Unchanged invariants:** `PathProgressRing` sm/md/lg presets are preserved — the numeric override is additive. `PathCardHeader` gradient/cover image resolution logic is unchanged. The placeholder ring `Skeleton` in `usePathProgress` is unchanged — only `PathCardSkeleton` in `LearningPaths.tsx` is updated. Sync engine path for `coverImageUrl`/`coverPreset` is unchanged.
- **Integration coverage:** The upload error diagnostics (Unit 1) should be validated by triggering each failure mode — this requires manipulating Supabase state (sign out, use invalid file, simulate network failure via dev tools).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Taller card (360-380px) reduces cards-per-viewport on smaller screens (~12% fewer cards visible per scroll) | Grid is responsive (1-4 columns); on mobile (1 col) the taller card is still usable. Accept the trade-off for better visual design. The information density loss is modest — from ~8 to ~7 cards visible on a standard 1080p display — and the improved visual hierarchy from the larger ring and button may improve scan efficiency. |
| 80px ring with text-lg may overflow on extreme edge cases (very long percentage text) | Percentage is always ≤ 3 chars ("100%") — fits comfortably in 80px with text-lg. Verified by design. |
| PathProgressRing numeric size extension may conflict with existing size prop typing | Add `number` to the union type; TypeScript narrows correctly via `typeof size === 'number'` check at runtime. Backward-compatible — existing string callers are unaffected. |
| Upload error differentiation may surface RLS policy issues that require Supabase config changes | The diagnostic messages will identify RLS rejection (typically a 403 or 425 status). If RLS is the cause, the migration needs to be deployed — that's a Supabase CLI operation, not a code change. |
| `Separator` component import not yet in LearningPaths.tsx | Add the import — Separator is a standard shadcn/ui component, already in the project |
| Dark mode shadows and borders may be invisible with `shadow-sm` | `shadow-sm` is very subtle (0 1px 2px at 5% opacity). On dark card backgrounds, it may be invisible. The existing `Card` border provides an adequate fallback visual separator. Deferred dark mode validation will confirm. |
| Design refresh (Units 2-5) and upload diagnostics (Unit 1) are bundled in one PR, creating shared fate | If the design refresh needs reversion, the diagnostics can be cherry-picked into a separate PR since they touch different files (pathCoverUpload.ts is only in Unit 1). The bundling is intentional — both were reported together and the combined diff is small. |
| Deferred dark mode gradient tweaks: taller header (h-32) exposes more hardcoded gradient area | PathCardHeader gradient colors (e.g., `from-cyan-400`) are hardcoded Tailwind classes, not design tokens. The 33% taller header increases the surface area where dark mode may look wrong. Deferred to a follow-up task explicitly. |

## Sources & References

- **Design reference:** User-provided Lumina HTML mockup (spec captured in Requirements Trace; file not in repository)
- **Prior plan (ring + RLS):** [docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md](docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md)
- **Implementation lessons:** [docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md)
- **Cover dialog patterns:** [docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md](docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md)
- **Related code:**
  - [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx)
  - [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx)
  - [src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx)
  - [src/lib/pathCoverUpload.ts](src/lib/pathCoverUpload.ts)
  - [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx)
  - [supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql](supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql)
