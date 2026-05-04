---
title: feat: Apple-style redesign via Clean theme activation
type: feat
status: active
date: 2026-05-04
---

# feat: Apple-style redesign via Clean theme activation

## Overview

Activate the existing Clean theme as default, remove the grain texture, and refine the layout shell using a single Stitch reference screen. Evaluate before doing more — the Clean theme may already do 70% of the work. Only pages that actually look wrong after shell refinement get targeted Stitch references.

## Problem Frame

The Clean theme scheme already exists in `src/styles/theme.css` with Apple blue (`#005bc1`), Inter font, and cool blue-white surfaces. It was implemented as a token swap but never activated as the default — nobody has seen the full app in Clean mode. The current Professional theme (warm cream, purple-blue, DM Sans + Space Grotesk) is the visible default.

The hypothesis: Clean + grain removal + layout shell refinements gets 90% of the Apple aesthetic. The remaining 10% is per-page tweaks, discovered by actually looking at the app in Clean mode, not by planning them upfront.

## Requirements Trace

- **R1.** Clean theme is the default scheme; Professional and Vibrant remain as user options
- **R2.** Grain-overlay paper texture is removed when Clean is active
- **R3.** The layout shell (sidebar, header, content area) is refined against a single Stitch reference screen
- **R4.** All pages are audited in Clean mode — pages that look wrong get targeted Stitch references and refinements
- **R5.** Dark mode is coherent across all pages
- **R6.** Responsive behavior works at mobile, tablet, and desktop
- **R7.** All implementation uses semantic design tokens — zero hardcoded colors

## Scope Boundaries

- The redesign is visual/layout only — no behavior changes, no new features, no data model changes
- One Stitch reference screen for the layout shell; per-page Stitch screens only if a page looks wrong after shell refinement
- Existing shadcn/ui components are preserved; they receive styling refinements, not replacements
- Page routes, navigation structure, and component APIs remain unchanged

### Deferred to Separate Tasks

- Professional and Vibrant theme scheme polish
- Per-page Stitch reference screens for pages that are fine after shell refinement

## Key Technical Decisions

- **Activate first, generate later.** Toggle Clean on and see what actually needs work before generating any Stitch screens. Don't solve problems that might not exist.
- **Stitch for the shell only (initially).** The layout shell is the single highest-leverage file — it sets the visual tone for every page. One Stitch reference screen for the desktop layout is enough to extract the key design decisions.
- **Evaluate before scaling.** After shell refinement, audit every page. Generate per-page Stitch references only for pages with visible issues. This prevents generating screens for pages that already look good.
- **No Stitch design system.** Creating a design system before generating screens adds a dependency that can fail (Stitch verbosity errors). The Clean tokens are already encoded in the app — Stitch needs only a text prompt describing the desired visual direction, not a machine-readable token catalog.
- **Clean becomes default via settings.ts change.** This is a deliberate one-line behavior change to the default scheme — the only behavior change in scope.
- **Radius, shadows, and easing stay as-is until evidence shows they need changing.** Don't pre-decide token refinements. Let the Clean-mode audit surface concrete problems.

## Context & Research

### Relevant Code and Patterns

- **Clean theme tokens**: `src/styles/theme.css` lines 421-633 — complete Apple-inspired token set
- **Theme bridge**: `src/styles/theme.css` lines 650-741 — CSS custom properties mapped to Tailwind v4 via `@theme inline`
- **Layout shell**: `src/app/components/Layout.tsx` — desktop sidebar (220px/72px), sticky header, mobile Sheet + BottomNav
- **Settings default**: `src/lib/settings.ts` line 97 — `colorScheme: 'professional'` hardcoded default
- **Grain overlay**: `src/styles/index.css` lines 272 and 282 (grain-overlay::after rules), `Layout.tsx` line 510 (class usage)
- **BottomNav**: `src/app/components/navigation/BottomNav.tsx`
- **Additive token pattern**: `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md`
- **Zone-based layout pattern**: `docs/solutions/best-practices/reports-page-redesign-patterns-2026-05-02.md`

### Institutional Learnings

- **Stitch fights existing component architecture on dense pages** (`docs/solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md`): Stitch generates standalone HTML. Use it for visual direction on the shell, not for per-page code generation.
- **Stitch MCP canonical usage** (user memory `feedback_stitch_mcp_usage.md`): `-d` flag, bare numeric `projectId`, `GEMINI_3_1_PRO` model, `DESKTOP`/`MOBILE` device types, 1-3 minute generation time.

### External References

- Stitch MCP CLI: `npx @_davideast/stitch-mcp` — verified healthy (2026-05-04)
- Existing Stitch Apple-style references: 12 HTML files in `docs/design-references/stitch-apple-style/` (reference material, not spec)

## Implementation Units

- [ ] **Unit 1: Activate Clean theme as default and remove grain**

**Goal:** Make Clean the default theme, remove the grain overlay texture, and audit every page to establish the baseline.

**Requirements:** R1, R2, R4 (audit portion)

**Dependencies:** None

**Files:**
- Modify: `src/lib/settings.ts` (change default `colorScheme` from `'professional'` to `'clean'`)
- Modify: `src/styles/index.css` (scope grain-overlay to `html:not(.clean) .grain-overlay`)
- Modify: `src/app/components/Layout.tsx` (remove unconditional `grain-overlay` class)
- No new tests (config change + CSS scoping)

**Approach:**
- Change the hardcoded default in `settings.ts` from `'professional'` to `'clean'`
- Scope `.grain-overlay::after` CSS rules to only apply when Clean is NOT active: `html:not(.clean) .grain-overlay::after`
- Remove the `grain-overlay` class from Layout.tsx root div (the CSS scoping handles it for non-Clean themes)
- Start dev server, navigate every page in Clean light and Clean dark
- Catalog issues: which pages look wrong? What specific visual problems exist? Screenshot key problems
- This audit output directly determines whether Units 3+ are needed

**Test scenarios:**
- Happy path: App loads with Clean theme by default (fresh session)
- Happy path: Professional and Vibrant still work when explicitly selected
- Happy path: Grain overlay absent in Clean; present in Professional/Vibrant
- Edge case: Existing users with Professional saved as preference are unaffected
- Edge case: Dark mode toggle works, Clean dark renders correctly

**Verification:**
- `npm run build` passes
- `npm run lint` passes
- Visual audit: all pages navigated, issues cataloged
- Clean light and Clean dark both render without visual breakage

---

- [ ] **Unit 2: Generate Stitch layout shell reference and implement refinements**

**Goal:** Generate one Stitch reference screen for the desktop layout shell, extract design intent, and refine Layout.tsx to match. This is the single highest-leverage change — it affects every page.

**Requirements:** R3, R7

**Dependencies:** Unit 1 (Clean is active, grain is gone, baseline is known)

**Files:**
- No codebase files modified by Stitch generation (Stitch cloud resource)
- Modify: `src/app/components/Layout.tsx`
- Modify: `src/app/components/navigation/BottomNav.tsx` (mobile refinements if needed)
- Test: update existing Layout/BottomNav tests if DOM structure changes

**Approach:**
- Generate one Stitch screen: desktop layout with sidebar (expanded) + header + content area placeholder. Prompt with: "Learning platform layout. Left sidebar with navigation groups, sticky top header with search and user menu, main content area. Apple HIG aesthetic — generous whitespace, subtle separators, content-first hierarchy. Cool blue-white surfaces, Inter font."
- Use `deviceType: "DESKTOP"`, `modelId: "GEMINI_3_1_PRO"`. Do NOT create a Stitch design system — the prompt carries the visual direction.
- Extract design intent from the Stitch HTML: sidebar spacing, nav item padding, active state style, header height, header-to-content relationship (floating vs. integrated), content padding
- Apply to Layout.tsx using existing semantic tokens (no new tokens unless a clear gap exists)
- If the Stitch reference uses a specific active indicator pattern (filled pill, leading bar, etc.), adopt that pattern consistently
- If a token gap exists (e.g., header needs a specific surface color not in the Clean scheme), add it additively — define in all four theme blocks, map once in `@theme inline`
- Mobile BottomNav: apply the same visual language (spacing, active state, typography) as the desktop sidebar

**Test scenarios:**
- Happy path: Desktop layout renders with refined Apple-style sidebar and header
- Happy path: Mobile layout renders BottomNav with matching visual language
- Happy path: Tablet layout triggers Sheet sidebar correctly
- Edge case: Sidebar collapsed state (72px) still functions
- Edge case: All nav items navigate correctly
- Edge case: Theme toggle, notifications, user dropdown, search palette all work
- Edge case: Keyboard navigation intact
- Edge case: Focus rings visible on all interactive elements

**Verification:**
- Visual comparison: Layout.tsx side-by-side with Stitch reference screen
- All existing Playwright E2E tests pass
- Responsive: 375px, 768px, 1024px, 1440px
- `npm run build` passes, `npm run lint` passes

---

- [ ] **Unit 3: Audit and refine pages that need it**

**Goal:** After Clean activation and shell refinement, navigate every page. For pages that look wrong, generate a targeted Stitch reference and refine. For pages that look fine, do nothing.

**Requirements:** R4, R7

**Dependencies:** Unit 2 (layout shell is refined, visual baseline is set)

**Files:**
- Modify: only pages that look wrong after Units 1-2 (discovered during audit, not predetermined)
- Test: update existing page tests for any modified pages

**Approach:**
- Navigate every route in the app with Clean active + refined shell
- For each page, answer: does this look Apple-like and coherent with the shell? If yes, skip it.
- For pages that look wrong, identify the specific issue (e.g., "cards have too much padding for Clean's tighter feel," "section spacing is inconsistent," "typography hierarchy is unclear")
- Generate a Stitch reference for that specific page only if the fix isn't obvious from the issue description
- Implement refinements using existing semantic tokens
- This unit may result in zero page changes — that's a successful outcome, not a failure

**Test scenarios:**
- Happy path: App is visually coherent across all pages
- Edge case: Pages that weren't modified still look good with the new shell
- Edge case: Dark mode on every page

**Verification:**
- Visual audit: every page in Clean light and Clean dark
- All existing unit tests pass
- All existing E2E tests pass
- `npm run build` passes, `npm run lint` passes

---

- [ ] **Unit 4: Cross-cutting polish**

**Goal:** Dark mode coherence, responsive behavior, accessibility verification, and Professional/Vibrant sanity check.

**Requirements:** R5, R6

**Dependencies:** Unit 3 (all page refinements complete, or confirmed unnecessary)

**Files:**
- Minor fixes in any file as needed (scope limited to visual/accessibility)

**Approach:**
- Dark mode: toggle on every page, verify contrast and coherence
- Responsive: verify at 375px, 768px, 1024px, 1440px
- Accessibility: verify focus rings, touch targets (≥44px), color contrast (≥4.5:1), keyboard navigation, `prefers-reduced-motion`
- Professional/Vibrant: toggle each on 3-4 key pages, verify no visual breakage from layout changes
- Fix issues found — scope limited to visual/accessibility fixes

**Test scenarios:**
- Happy path: Every page passes dark mode visual audit
- Happy path: Every page usable at all 4 breakpoints
- Edge case: Focus rings visible and compliant (WCAG 2.4.13)
- Edge case: Touch targets ≥ 44x44px on mobile
- Edge case: Color contrast ≥ 4.5:1 for text, 3:1 for large text
- Edge case: Professional and Vibrant themes still visually coherent

**Verification:**
- Design review report: no BLOCKER findings
- `npm run build` passes, `npm run lint` passes, `npx tsc --noEmit` passes
- All Playwright E2E tests pass

## System-Wide Impact

- **Interaction graph:** Layout.tsx changes affect every wrapped route. The `settings.ts` default change affects all new sessions.
- **Error propagation:** No changes to error handling.
- **State lifecycle risks:** Existing users with Professional saved as preference are unaffected by the default change. The Clean activation is for new sessions and users who haven't set a preference.
- **Unchanged invariants:** All route paths, navigation structure, component APIs, data fetching patterns, and business logic.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Stitch screen generation fails or produces unusable output | The shell refinements can proceed without Stitch — Apple HIG principles (generous whitespace, subtle separators, content-first) are well-known and can be applied directly to Layout.tsx |
| Layout.tsx changes break E2E selectors | Run E2E tests after Unit 2. Update selectors if needed. |
| Clean theme exposes pre-existing contrast issues | Unit 4 catches these. Fix in Unit 4. |
| Professional/Vibrant look wrong with new layout spacing | Unit 4 audit. Scope layout changes to Clean-only if needed. |

## Sources & References

- Clean theme tokens: `src/styles/theme.css` lines 421-633
- Layout shell: `src/app/components/Layout.tsx`
- Settings default: `src/lib/settings.ts` line 97
- BottomNav: `src/app/components/navigation/BottomNav.tsx`
- Stitch MCP memory: user memory `feedback_stitch_mcp_usage.md`
- Stitch Apple references: `docs/design-references/stitch-apple-style/`
- Additive token pattern: `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md`
