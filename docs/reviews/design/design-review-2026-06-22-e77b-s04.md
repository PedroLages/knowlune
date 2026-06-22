# Design Review Report

**Review Date**: 2026-06-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP + static analysis)
**Story**: E77B-S04 — Drive Source Management UI and Sync Validation
**Changed Files**: 7 files changed, 569 insertions(+), 1 deletion(-)
- `src/app/components/figma/ImportedCourseCard.tsx`
- `src/app/pages/UnifiedCourseDetail.tsx`
- `src/app/components/settings/DriveConfigurationSettings.tsx`
- `src/app/components/settings/sections/IntegrationsDataSection.tsx`
- `src/stores/useCourseImportStore.ts`
- `src/app/components/courses/__tests__/CourseCard.driveSource.test.tsx`
- `docs/implementation-artifacts/E77B-S04.md`

**Affected Pages**: `/courses`, `/my-class`, `/authors`, `/authors/:authorId`, `/courses/:courseId`, `/settings`

**Review Methodology**: Static code analysis, git diff review, Playwright browser automation (responsive testing at 375px/768px/1440px), unit test execution, design token verification, accessibility audit.

---

## Executive Summary

This story adds Drive source management UI across three areas: a Drive badge on course cards, a Drive source banner with reconnect flow on the course detail page, and a Drive configuration card in Settings. The course card badge and Settings configuration card are implemented correctly with good design token usage, proper ARIA labels, and passing unit tests. However, there is a single **blocker**: the Drive source banner and reconnect flow were added to `UnifiedCourseDetail.tsx`, which is no longer the active component for `/courses/:courseId` -- that route now renders `CourseOverview.tsx`. The banner is never displayed, meaning acceptance criteria 2, 3, and 4 are unmet in the running application.

---

### Findings by Severity

#### Blocker (Must fix before merge)
1. Drive source banner and reconnect flow rendered in wrong component

#### High Priority (Should fix before merge)
(none)

#### Medium Priority (Fix when possible)
(none)

#### Nitpicks (Optional)
(none)

---

### What Works Well

1. **Drive badge on course cards**: The `ImportedCourseCard` Drive badge (lines 777-785) is cleanly implemented with proper design tokens (`bg-brand-soft/80`, `text-brand-soft-foreground`), correct ARIA attribution (`aria-hidden="true"` on the icon), and a `data-testid` attribute for reliable test targeting. The badge correctly only renders when `course.source === 'drive'`.

2. **DriveConfigurationSettings component**: Well-designed component with proper state handling for all scenarios: loading (scope checking), empty (not connected), connected (with email display), read scope granted/denied states, and a disconnect flow with confirmation dialog. All interactive elements have ARIA labels, proper touch targets (min-h-[44px]), and use design tokens consistently.

3. **Unit test coverage**: The `CourseCard.driveSource.test.tsx` file has 4 focused tests covering all badge states: drive source shown, local source hidden, youtube source hidden, and badge coexistence with video count. All 4 tests pass.

4. **Store extensibility**: The `sourceDriveId` field on `CourseDetailsUpdate` follows the existing optional-fields pattern, maintaining backward compatibility with existing callers.

5. **IntegrationsDataSection wiring**: `DriveConfigurationSettings` is cleanly inserted between `WhisperSettings` and the Data Management card, respecting the existing section hierarchy.

---

### Detailed Findings

#### Blocker 1: Drive source banner and reconnect flow rendered in wrong component

**Issue**: The Drive source banner (AC #2) and reconnect flow (AC #3, #4) were added to `UnifiedCourseDetail.tsx`, but this component is NOT rendered by the active route. The route `/courses/:courseId` (defined at `src/app/routes.tsx:450-456`) renders `CourseOverview.tsx`, not `UnifiedCourseDetail.tsx`. `CourseOverview.tsx` has zero Drive-related code -- no import of `HardDrive` icon, no `DriveFolderBrowser`, no reconnect handler, and no Drive source banner.

**Location**: `src/app/pages/UnifiedCourseDetail.tsx:403-428` (Drive banner), `src/app/pages/UnifiedCourseDetail.tsx:280-309` (reconnect handler), `src/app/pages/UnifiedCourseDetail.tsx:490-494` (DriveFolderBrowser mounting)

**Impact**: Users with Drive-imported courses will never see the "Google Drive Course" banner or the "Reconnect" button when viewing their course details. The reconnect flow is dead code. This breaks 3 of the 8 acceptance criteria.

**Suggestion**: Move the Drive source banner (`storeCourse?.source === 'drive'` block), the `handleReconnectFolder` callback, the `reconnectOpen`/`isReconnecting` state, and the `DriveFolderBrowser` component to `CourseOverview.tsx`, matching the same conditional pattern (`source === 'drive'`). Alternatively, if `UnifiedCourseDetail` should still be the active component, update the router to use it instead of `CourseOverview` at `/courses/:courseId`.

**AC Mapping**: AC #2 ("Drive source banner with Reconnect button"), AC #3 ("Reconnect folder maps file IDs"), AC #4 ("toast shows match count") are all affected.

---

### Acceptance Criteria Coverage

| AC | Description | Status | Notes |
|----|------------|--------|-------|
| 1 | Drive badge on course card | Pass | Implemented in `ImportedCourseCard.tsx`, tested |
| 2 | Drive source banner with Reconnect button | Fail | Added to `UnifiedCourseDetail` but route renders `CourseOverview` |
| 3 | Reconnect folder maps file IDs to lessons | Fail | Handler exists in `UnifiedCourseDetail` but never reached |
| 4 | Toast shows match count after reconnect | Fail | Handler exists in `UnifiedCourseDetail` but never reached |
| 5 | Settings shows Drive configuration card | Pass | Implemented in `DriveConfigurationSettings.tsx`, wired in section |
| 6 | Grant Access button for drive.readonly scope | Pass | Implemented with proper disabled state handling |
| 7 | Disconnect with confirmation dialog | Pass | AlertDialog with clear description and actions |
| 8 | `updateCourseDetails` with `sourceDriveId` | Pass | Store accepts and persists the field |

---

### Visual Polish Verification

- **Drive badge**: Uses `bg-brand-soft/80` (soft brand with 80% opacity), `text-brand-soft-foreground`, `rounded-md`, `text-[10px]` -- consistent with other metadata badges in the app. The `/80` opacity modifier helps the badge blend subtly into the card footer.

- **DriveConfigurationSettings**: Card header uses `border-b border-border/50 bg-surface-sunken/30` matching other settings cards. Content spacing uses `space-y-4` with `pt-6` (consistent 24px/1.5rem padding). Confirmation dialog uses `rounded-2xl` matching the card border-radius pattern.

---

### Responsive Design Verification

- **Mobile (375px)**: Pass - No horizontal overflow at any tested breakpoint. Layouts reflow correctly using responsive Tailwind utilities.

- **Tablet (768px)**: Pass - Layouts adapt correctly. No overflow issues.

- **Sidebar Collapse (1024px)**: Pass - Standard sidebar behavior respected.

- **Desktop (1440px)**: Pass - Full layout renders correctly.

---

### Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | Pass | Design tokens used throughout; `text-brand-soft-foreground` on `bg-brand-soft` passes contrast |
| Keyboard navigation | Pass (code review) | All buttons use semantic `<button>` elements; AlertDialog has built-in keyboard handling |
| Focus indicators visible | Pass (code review) | Radix UI AlertDialog handles focus management; buttons have default focus rings |
| Heading hierarchy | Pass | `CardTitle` (h3), `h3` sub-headings used in settings card |
| ARIA labels on icon buttons | Pass | All icon-only buttons have `aria-label` (Reconnect Drive, Grant Access, Disconnect) |
| Semantic HTML | Pass | Uses `<button>`, `<Card>`, `<AlertDialog>` semantic components |
| Form labels associated | N/A | No forms in this change set |
| `prefers-reduced-motion` | Pass | No custom animations introduced |
| Icon `aria-hidden` usage | Pass | All decorative icons use `aria-hidden="true"` |
| `aria-live` regions | N/A | Toast notifications use Sonner (handles `aria-live` automatically) |

---

### Recommendations

1. **BLOCKER**: Move the Drive source banner and reconnect flow from `UnifiedCourseDetail.tsx` to `CourseOverview.tsx` to make the course detail page functional for Drive-imported courses. This is the highest priority fix -- without it, three acceptance criteria are unmet and Drive-imported course users have no way to reconnect their folders.

2. Consider adding a pre-existing sync engine issue note: the console logs `[syncEngine] Download error for table "quiz_attempts": column quiz_attempts.updated_at does not exist` and similar for `ai_usage_events`. These are pre-existing but add noise to the app console. They are not introduced by this story.
