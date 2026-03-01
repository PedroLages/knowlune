# shadcn/ui Component Adoption Plan

## Goal
Adopt 15 already-installed but unused shadcn/ui components across the LevelUp codebase. Eliminate hand-rolled patterns that duplicate what shadcn provides, improving accessibility, cross-browser consistency, and maintainability.

## Parallel Agent Assignments

### Tier 1 — High Impact, Low Effort

#### Agent 1: ToggleGroup → TopicFilter + StatusFilter
- **Files**: `src/app/components/figma/TopicFilter.tsx`, `src/app/components/figma/StatusFilter.tsx`
- **Change**: Replace raw `<button>` + `Badge` toggle patterns with `ToggleGroup type="multiple"` + `ToggleGroupItem`
- **Gains**: Proper `aria-pressed`, keyboard navigation between items, consistent focus rings

#### Agent 2: Progress → AchievementBanner
- **Files**: `src/app/components/AchievementBanner.tsx`
- **Change**: Replace `<div style={{width: X%}}>` progress bar with shadcn `Progress` component
- **Gains**: Consistency with Progress usage elsewhere in the app

#### Agent 3: ScrollArea → Overflow Containers
- **Files**: `src/app/pages/LessonPlayer.tsx`, `src/app/pages/Messages.tsx`, `src/app/components/figma/TranscriptPanel.tsx`
- **Change**: Replace `overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` with `ScrollArea`
- **Gains**: Cross-browser scrollbar normalization

#### Agent 4: Kbd → KeyboardShortcutsDialog
- **Files**: `src/app/components/figma/KeyboardShortcutsDialog.tsx`
- **Change**: Replace raw `<kbd>` elements with shadcn `Kbd` component
- **Gains**: Consistent keyboard shortcut badge styling

### Tier 2 — High Impact, Medium Effort

#### Agent 5: ChartContainer → Reports
- **Files**: `src/app/pages/Reports.tsx`
- **Change**: Wrap Recharts in `ChartContainer` + `ChartTooltip` + `ChartLegend`, remove manual `getChartColors()` dark mode function
- **Gains**: Auto dark mode via CSS variables, consistent tooltip styling

#### Agent 6: DropdownMenu → VideoPlayer Speed Menu
- **Files**: `src/app/components/figma/VideoPlayer.tsx`
- **Change**: Replace ~100-line hand-rolled ARIA menu (focus trap, click-outside, keyboard nav) with `DropdownMenu`
- **Gains**: Eliminates custom focus management code, proper Radix portal positioning

#### Agent 7: Breadcrumb → CourseDetail + LessonPlayer
- **Files**: `src/app/pages/CourseDetail.tsx`, `src/app/pages/LessonPlayer.tsx`
- **Change**: Replace `← Back to Courses` links with `Breadcrumb` component showing full navigation path
- **Gains**: `aria-label="Breadcrumb"`, `aria-current="page"`, consistent nav hierarchy

### Tier 3 — Nice-to-Have

#### Agent 8: Layout Polish (Button ghost + Kbd)
- **Files**: `src/app/components/Layout.tsx`
- **Change**: Replace raw `<button>` header icons with `Button variant="ghost" size="icon"`, replace `⌘K` raw `<kbd>` with `Kbd`
- **Gains**: Consistent hover/focus states from Button component

#### Agent 9: Alert → StudyStreakCalendar
- **Files**: `src/app/components/StudyStreakCalendar.tsx`
- **Change**: Replace raw div vacation/info notices with `Alert` + `AlertTitle` + `AlertDescription`
- **Gains**: Proper semantic alert role, consistent styling

#### Agent 10: Remove Unused Components
- **Files**: `src/app/components/ui/carousel.tsx`, `context-menu.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `input-otp.tsx`
- **Change**: Delete components with zero imports anywhere in the codebase
- **Gains**: Reduces `ui/` folder noise, removes dead dependencies

## Constraints
- All imports use `@/` alias (resolves to `./src`)
- `cn` utility lives at `./utils` (relative) inside `ui/` components, or `@/app/components/ui/utils` from pages
- Preserve all existing functionality — these are refactors, not feature changes
- Do not modify any test files
- Icons from `lucide-react` only
