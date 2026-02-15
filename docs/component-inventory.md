# LevelUp - Component Inventory

> Generated: 2026-02-15 | Scan Level: Quick

## Overview

LevelUp uses a layered component architecture:
1. **shadcn/ui Primitives** (46) - Base Radix UI components with Tailwind styling
2. **Custom Figma Components** (11) - Domain-specific components derived from Figma designs
3. **App-Level Components** (14+) - Page-specific and feature components
4. **Page Components** (10) - Route-level page layouts

## shadcn/ui Component Library (`src/app/components/ui/`)

Configuration: New York style, Radix UI primitives, class-variance-authority for variants.

### Form Controls
| Component | File | Radix Primitive |
|-----------|------|-----------------|
| Button | button.tsx | Slot |
| Checkbox | checkbox.tsx | Checkbox |
| Input | input.tsx | Native |
| Input OTP | input-otp.tsx | input-otp |
| Label | label.tsx | Label |
| Radio Group | radio-group.tsx | RadioGroup |
| Select | select.tsx | Select |
| Slider | slider.tsx | Slider |
| Switch | switch.tsx | Switch |
| Textarea | textarea.tsx | Native |
| Form | form.tsx | react-hook-form |

### Layout
| Component | File | Radix Primitive |
|-----------|------|-----------------|
| Accordion | accordion.tsx | Accordion |
| Aspect Ratio | aspect-ratio.tsx | AspectRatio |
| Card | card.tsx | Native div |
| Collapsible | collapsible.tsx | Collapsible |
| Resizable | resizable.tsx | react-resizable-panels |
| Scroll Area | scroll-area.tsx | ScrollArea |
| Separator | separator.tsx | Separator |
| Sidebar | sidebar.tsx | Custom |
| Tabs | tabs.tsx | Tabs |

### Overlays & Popups
| Component | File | Radix Primitive |
|-----------|------|-----------------|
| Alert Dialog | alert-dialog.tsx | AlertDialog |
| Context Menu | context-menu.tsx | ContextMenu |
| Dialog | dialog.tsx | Dialog |
| Drawer | drawer.tsx | Vaul |
| Dropdown Menu | dropdown-menu.tsx | DropdownMenu |
| Hover Card | hover-card.tsx | HoverCard |
| Menubar | menubar.tsx | Menubar |
| Popover | popover.tsx | Popover |
| Sheet | sheet.tsx | Dialog (side panel) |
| Tooltip | tooltip.tsx | Tooltip |

### Navigation
| Component | File | Radix Primitive |
|-----------|------|-----------------|
| Breadcrumb | breadcrumb.tsx | Native nav |
| Command | command.tsx | cmdk |
| Navigation Menu | navigation-menu.tsx | NavigationMenu |
| Pagination | pagination.tsx | Native nav |

### Data Display
| Component | File | Radix Primitive |
|-----------|------|-----------------|
| Alert | alert.tsx | Native div |
| Avatar | avatar.tsx | Avatar |
| Badge | badge.tsx | Native div |
| Calendar | calendar.tsx | react-day-picker |
| Carousel | carousel.tsx | embla-carousel |
| Chart | chart.tsx | Recharts |
| Progress | progress.tsx | Progress |
| Skeleton | skeleton.tsx | Native div |
| Table | table.tsx | Native table |

### Feedback
| Component | File | Radix Primitive |
|-----------|------|-----------------|
| Sonner | sonner.tsx | sonner |
| Toggle | toggle.tsx | Toggle |
| Toggle Group | toggle-group.tsx | ToggleGroup |

### Utilities
| File | Purpose |
|------|---------|
| utils.ts | `cn()` function (clsx + tailwind-merge) |
| use-mobile.ts | Mobile viewport detection hook |

## Custom Figma Components (`src/app/components/figma/`)

Domain-specific components translated from original Figma wireframes.

| Component | File | Purpose | Has Stories |
|-----------|------|---------|-------------|
| CourseCard | CourseCard.tsx | Display course with thumbnail and progress | Yes |
| EnhancedCourseCard | EnhancedCourseCard.tsx | CourseCard with extended progress info | No |
| ImageWithFallback | ImageWithFallback.tsx | Image with graceful error fallback | No |
| KeyboardShortcutsDialog | KeyboardShortcutsDialog.tsx | Keyboard shortcut reference overlay | No |
| LessonList | LessonList.tsx | List of lessons within a course | No |
| ModuleAccordion | ModuleAccordion.tsx | Expandable course module sections | No |
| PdfViewer | PdfViewer.tsx | PDF document rendering (pdfjs-dist) | No |
| ProgressRing | ProgressRing.tsx | Circular progress indicator (SVG) | No |
| ResourceBadge | ResourceBadge.tsx | Badge indicating resource type (video/pdf/etc) | No |
| SearchCommandPalette | SearchCommandPalette.tsx | Global search via command palette (cmdk) | No |
| VideoPlayer | VideoPlayer.tsx | HTML5 video player with custom controls | Yes |

## App-Level Components (`src/app/components/`)

Feature-specific components used across pages.

| Component | File | Purpose |
|-----------|------|---------|
| Layout | Layout.tsx | Main app layout (sidebar + header + content area) |
| AchievementBanner | AchievementBanner.tsx | Achievement/milestone notification banner |
| BookmarksList | BookmarksList.tsx | List of bookmarked lessons/content |
| EmptyState | EmptyState.tsx | Empty state placeholder with illustration |
| ProgressCourseCard | ProgressCourseCard.tsx | Course card with progress tracking |
| ProgressStats | ProgressStats.tsx | Progress statistics display |
| ProgressWidget | ProgressWidget.tsx | Dashboard progress widget |
| QuickActions | QuickActions.tsx | Quick action shortcuts |
| RecentActivity | RecentActivity.tsx | Recent activity feed |
| StatsCard | StatsCard.tsx | Statistics display card |
| StudyStreak | StudyStreak.tsx | Study streak display |
| StudyStreakCalendar | StudyStreakCalendar.tsx | Calendar view of study streaks |
| ProgressChart | charts/ProgressChart.tsx | Progress data chart (Recharts) |
| CompletionModal | celebrations/CompletionModal.tsx | Course/lesson completion celebration |
| ApiExample | examples/ApiExample.tsx | API integration demo component |
| BottomNav | navigation/BottomNav.tsx | Mobile bottom navigation bar |
| NoteEditor | notes/NoteEditor.tsx | Markdown note editor |

## Page Components (`src/app/pages/`)

Route-level page components rendered via React Router.

| Page | File | Route | Features |
|------|------|-------|----------|
| Overview | Overview.tsx | `/` | Stats cards, progress widget, recent activity, study streak |
| My Class | MyClass.tsx | `/my-class` | Active courses, assignments |
| Courses | Courses.tsx | `/courses` | Course library, import, search, filtering |
| Course Detail | CourseDetail.tsx | `/courses/:id` | Course modules, lessons, progress ring |
| Lesson Player | LessonPlayer.tsx | `/courses/:id/lessons/:lessonId` | Video player, PDF viewer, notes, bookmarks |
| Library | Library.tsx | `/library` | Personal course library |
| Messages | Messages.tsx | `/messages` | Messaging interface |
| Instructors | Instructors.tsx | `/instructors` | Instructor profiles |
| Reports | Reports.tsx | `/reports` | Analytics, charts, progress reports |
| Settings | Settings.tsx | `/settings` | App settings, AI provider config |

## Storybook Stories

| Story | File | Coverage |
|-------|------|----------|
| Button | stories/Button.stories.ts | Button variants |
| Header | stories/Header.stories.ts | App header |
| Page | stories/Page.stories.ts | Full page layout |
| CourseCard | components/figma/CourseCard.stories.tsx | Course card |
| VideoPlayer | components/figma/VideoPlayer.stories.tsx | Video player |
| Dashboard | stories/pages/Dashboard.stories.tsx | Overview page |
| LessonPlayer | stories/pages/LessonPlayer.stories.tsx | Lesson player page |
| CourseLibrary | stories/pages/CourseLibrary.stories.tsx | Courses page |
| CourseDetail | stories/pages/CourseDetail.stories.tsx | Course detail page |
| Library | stories/pages/Library.stories.tsx | Library page |
| MyProgress | stories/pages/MyProgress.stories.tsx | Progress page |
| Reports | stories/pages/Reports.stories.tsx | Reports page |
| StudyJournal | stories/pages/StudyJournal.stories.tsx | Journal page |

## Design System Notes

- **Style**: shadcn/ui New York variant
- **Colors**: OKLCH color space via CSS custom properties in theme.css
- **Background**: `#FAF5EE` (warm off-white)
- **Primary**: Blue-600 for CTAs and active states
- **Border Radius**: `rounded-[24px]` for cards, `rounded-xl` for buttons/inputs
- **Spacing**: 8px base grid via Tailwind
- **Icons**: Lucide React
- **Animations**: Motion (Framer Motion) + tw-animate-css
