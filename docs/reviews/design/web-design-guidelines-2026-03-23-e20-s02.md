# Web Interface Guidelines Review — E20-S02 Flashcard System

**Date:** 2026-03-23
**Story:** E20-S02 — Flashcard System with Spaced Repetition
**Reviewer:** Web Interface Guidelines (vercel-labs/web-interface-guidelines)
**Files reviewed:**
- `src/app/pages/Flashcards.tsx`
- `src/app/components/figma/FlashcardReviewCard.tsx`
- `src/app/components/notes/BubbleMenuBar.tsx`
- `src/app/components/notes/CreateFlashcardDialog.tsx`

---

## src/app/pages/Flashcards.tsx

src/app/pages/Flashcards.tsx:27 - **MEDIUM** — `FIXED_NOW = new Date()` at module scope creates a stale date; the value is captured once at import time and never refreshes. For a review queue, this means a user leaving the page open overnight won't see newly-due cards on the next render. Use `new Date()` inside the component or a `useRef` initialised inside the component.

src/app/pages/Flashcards.tsx:32-33 - **LOW** — `formatNextReviewDate` calls `new Date()` (not `FIXED_NOW`) directly inside the function, creating an inconsistency: the "now" used for comparison inside this helper drifts from the `FIXED_NOW` used everywhere else. Both should use the same reference.

src/app/pages/Flashcards.tsx:37 - **LOW** — `if (date < tomorrow) return 'Tomorrow'` is wrong for today's cards: any date before tomorrow (including today) returns "Tomorrow". Cards due today should return "Today" or equivalent, not "Tomorrow".

src/app/pages/Flashcards.tsx:40 - **LOW** — `toLocaleDateString('en-US', ...)` is a hardcoded locale. Use `Intl.DateTimeFormat` with `navigator.languages` or no locale argument to respect the user's locale. Per guidelines: "Dates/times: use `Intl.DateTimeFormat` not hardcoded formats."

src/app/pages/Flashcards.tsx:149-151 - **MEDIUM** — Raw `setTimeout(..., 500)` used to focus the card after flip animation. No ref cleanup — if the component unmounts before the timeout fires, `cardRef.current` will be null but the query still executes. Store the timeout ID in a ref and clear it in a `useEffect` cleanup. Also violates the "Avoid `waitForTimeout`" spirit even outside of tests; prefer listening for the animation's `onAnimationComplete` event from Framer Motion.

src/app/pages/Flashcards.tsx:210-216 - **LOW** — Loading skeleton uses `grid-cols-3` without a mobile breakpoint. On narrow screens (< 400 px) three 24px-high skeletons will be cramped. Dashboard stats grid at line 270 has the same issue (`grid grid-cols-3 gap-4`). Use `grid-cols-1 sm:grid-cols-3` or similar.

src/app/pages/Flashcards.tsx:264 - **LOW** — `<h1>` text "Flashcards" is in Title Case — correct. The sub-heading at line 311 (`<h2 className="text-sm font-medium">Upcoming Reviews</h2>`) is also Title Case — correct. The heading hierarchy is `h1 → h2`, which is correct. No issue here.

src/app/pages/Flashcards.tsx:309 - **LOW** — `<div className="flex items-center gap-2 mb-4">` — Tailwind `mb-*` spacing utility inside a `space-y-*` parent can double-stack margins. Minor but consider using `gap-*` on the parent `CardContent` instead.

src/app/pages/Flashcards.tsx:360-361 - **MEDIUM** — "← Back" button uses a raw Unicode left arrow (`←`) rather than a Lucide icon (`<ArrowLeft />`). Raw Unicode arrows do not inherit `currentColor` and will not scale with font tokens. Use a Lucide `ArrowLeft` icon wrapped in `aria-hidden="true"` with a visible text label, or use `<ChevronLeft />` matching the rest of the codebase.

src/app/pages/Flashcards.tsx:360 and 366 - **LOW** — Two separate "Back" buttons ("← Back" and "End Session") both call `handleBackToDashboard`. Users pressing Tab will land on both. The duplicate navigation at top-left and top-right is potentially confusing — consider making one primary ("End Session") and removing the redundant "← Back" from the review header.

src/app/pages/Flashcards.tsx:404 - **LOW** — `<h2 className="font-display text-xl tracking-tight">Session Complete</h2>` — heading hierarchy: the summary card is rendered after the dashboard `<h1>` is gone (different `phase`), so using `<h2>` is fine, but the card is the only content; semantically `<h1>` would be more appropriate here since there is no parent heading on the page at this point.

src/app/pages/Flashcards.tsx:539 - **LOW** — `transition-all` used in `RatingBar` (`className={cn('absolute inset-y-0 left-0 rounded-full transition-all', className)}`). Per guidelines: "Never `transition: all` — list properties explicitly." Change to `transition-[width]`.

src/app/pages/Flashcards.tsx:482 - **LOW** — Fallback `return null` renders an empty page with no content if `phase === 'reviewing'` but `currentCard` is undefined (race condition between phase state and store state). Should either redirect to dashboard or render a recovery message.

---

## src/app/components/figma/FlashcardReviewCard.tsx

src/app/components/figma/FlashcardReviewCard.tsx:43 - **LOW** — Inline style `perspective: 1000` uses a bare number. CSS `perspective` requires a length unit (e.g. `1000px`). Framer Motion / JSDOM may coerce this but real browsers may not apply the effect correctly. Change to `perspective: '1000px'`.

src/app/components/figma/FlashcardReviewCard.tsx:67 and 115 - **MEDIUM** — `<Layers className="size-5" />` icon inside a non-interactive decorative container is missing `aria-hidden="true"`. Per guidelines: "Decorative icons need `aria-hidden='true'`." These icons represent the course badge and are purely decorative.

src/app/components/figma/FlashcardReviewCard.tsx:92 - **LOW** — `<RotateCcw className="size-4" />` in the flip hint row is decorative and missing `aria-hidden="true"`.

src/app/components/figma/FlashcardReviewCard.tsx:93 - **LOW** — Copy uses `·` (middle dot) as a separator. Typography guideline prefers `—` or explicit spacing. Minor. More importantly: "Space / ↵" uses straight characters, not Unicode arrows — acceptable but inconsistent with the `↵` in `CreateFlashcardDialog:73`.

src/app/components/figma/FlashcardReviewCard.tsx:46 - **LOW** — `transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}` — `MotionConfig reducedMotion="user"` handles reduced-motion at the config level (correct), but the explicit `transition` override on `motion.div` may bypass the `MotionConfig` reduced-motion setting in some versions of Framer Motion. Verify the flip animation actually disables/reduces when `prefers-reduced-motion: reduce` is active.

src/app/components/figma/FlashcardReviewCard.tsx:100-108 - **LOW** — The back face `<div>` has `aria-hidden={!isFlipped}` but is still in the DOM and can receive focus on some screen readers when `visibility: hidden` is applied via inline style. The `tabIndex` guard is only on the front face. Consider adding `tabIndex={-1}` or `inert` attribute to the back face when not flipped, mirroring the front face's `tabIndex={isFlipped ? -1 : 0}` pattern.

---

## src/app/components/notes/BubbleMenuBar.tsx

src/app/components/notes/BubbleMenuBar.tsx:79 - **LOW** — `<BubbleButton onClick={onCreateFlashcard} aria-label="Create Flashcard">` — `aria-label` is present and correct. The `Layers` icon inside at line 80 is missing `aria-hidden="true"` since the button already has a label. Per guidelines: "Decorative icons need `aria-hidden='true'`."

src/app/components/notes/BubbleMenuBar.tsx:18-25 — `TEXT_COLORS` array contains raw hex values (`#dc2626`, `#2563eb`, etc.) and raw Tailwind color classes (`bg-red-600`, `bg-blue-600`). The swatch classes are hardcoded Tailwind colors, not design tokens. Per `styling.md`: "Never use hardcoded Tailwind colors." This is pre-existing code, not introduced by this story — flagging as **LOW** for awareness. The ESLint `design-tokens/no-hardcoded-colors` rule may already be flagging this.

---

## src/app/components/notes/CreateFlashcardDialog.tsx

src/app/components/notes/CreateFlashcardDialog.tsx:68 - **LOW** — `<Layers className="size-4" />` icon inside the dialog header `<div>` is purely decorative (the `DialogTitle` provides the label) and is missing `aria-hidden="true"`.

src/app/components/notes/CreateFlashcardDialog.tsx:73 - **LOW** — "Press ⌘↵ to save." is Mac-only copy. Windows/Linux users use Ctrl+↵. The keyboard handler at line 56 already handles both `e.metaKey || e.ctrlKey`, but the displayed hint only shows the Mac shortcut. Show `Ctrl+↵` on non-Mac or use a generic "Cmd/Ctrl+↵" label.

src/app/components/notes/CreateFlashcardDialog.tsx:86 - **LOW** — `autoFocus` on the front `Textarea` — guidelines say "autoFocus sparingly — desktop only, single primary input; avoid on mobile." This is a dialog context so autofocus is appropriate on desktop, but should be guarded for mobile (e.g., `autoFocus={!isMobile}` or media-query-aware check) to avoid the keyboard obscuring the dialog on small screens.

src/app/components/notes/CreateFlashcardDialog.tsx:84 - **LOW** — `placeholder="The question or concept to memorize…"` — trailing `…` (ellipsis) is correct per guidelines. Same for line 96 `"The answer or explanation…"`. No issue.

src/app/components/notes/CreateFlashcardDialog.tsx:115 - **LOW** — Create button is correctly disabled while `!front.trim() || !back.trim() || isSubmitting` and shows spinner text "Creating…". However, when disabled due to empty fields, there is no inline error or hint explaining why the button is disabled. Consider adding a `<p>` with `aria-live="polite"` on submit-attempt with empty fields to explain the validation state rather than silently ignoring the click (`handleCreate` returns early at line 45 without feedback).

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| BLOCKER  | 0     | —     |
| HIGH     | 0     | —     |
| MEDIUM   | 4     | Stale `FIXED_NOW`, `setTimeout` without cleanup, raw `←` arrow, missing `tabIndex` on back face |
| LOW      | 16    | Decorative icon `aria-hidden`, hardcoded locale, `transition-all`, `grid-cols-3` no mobile breakpoint, perspective unit, off-by-one "Tomorrow" label, Mac-only shortcut copy, `autoFocus` on mobile, no empty-field feedback, duplicate Back buttons, null fallback |

No BLOCKER or HIGH findings. All MEDIUM items are addressable without architectural changes.
