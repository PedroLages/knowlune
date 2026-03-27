# Learning Paths Redesign

## Context

The Learning Paths list and detail pages currently use minimal card layouts — flat cards with thin progress bars and plain course lists. Two Stitch prototypes were selected that introduce richer visual design: gradient card headers with SVG progress rings for the list page, and a winding trail map with hero course layout for the detail page.

This plan re-skins both pages while preserving all existing functionality (drag-drop reorder, all dialogs, AI suggest order, course picker) and adds new UI elements from the prototypes.

## Design Reference

- **List page HTML**: Stitch prototype with gradient headers, SVG circular progress rings, overlapping course thumbnail avatars, status differentiation (completed/active/not-started)
- **Detail page HTML**: Stitch prototype with winding SVG trail map, hero "Now Learning" card, horizontal completed courses strip, right sidebar with upcoming courses, "Suggest Order" AI button, daily tip card

## Style Adaptations (Stitch → Knowlune)

| Stitch prototype | Knowlune equivalent |
|---|---|
| `bg-gradient-to-br from-cyan-400 to-blue-600` | Keep gradients — these are decorative, not semantic colors. Use CSS custom properties for path-specific gradients |
| `text-stone-900`, `text-stone-500` | `text-foreground`, `text-muted-foreground` |
| `bg-white` cards | `bg-card` |
| `border-stone-100` | `border-border` |
| `bg-[#FAF5EE]` | `bg-background` |
| `text-blue-600`, `bg-blue-600` | `text-brand`, `bg-brand` |
| `text-green-600`, `bg-green-500` | `text-success`, `bg-success` |
| Material Symbols icons | Lucide React icons |
| `rounded-[24px]` | Keep — matches existing card style |
| `shadow-sm`, `shadow-xl` | Keep — standard Tailwind |
| Tailwind CDN | Existing Tailwind v4 setup |

## Implementation Steps

### Step 1: Create PathProgressRing component
**File**: `src/app/components/figma/PathProgressRing.tsx`

New SVG circular progress ring component extracted from the Stitch prototype. Props: `percentage`, `size`, `strokeWidth`, `colorClass`. Uses `stroke-dasharray`/`stroke-dashoffset` for the animated ring. Replaces the thin linear progress bar on list cards.

### Step 2: Create PathGradient utility
**File**: `src/app/components/figma/PathCardHeader.tsx`

A component that renders the gradient header area for path cards. Accepts a `seed` (path name or index) to deterministically pick a gradient from a preset array. Includes the overlapping "completed" overlay badge for 100% paths and the "AI Generated" sparkle badge.

Gradient presets (array, indexed by hash of path name):
- cyan→blue, emerald→green, purple→indigo, stone (for not-started), orange→blue, pink→purple

### Step 3: Create TrailMap component
**File**: `src/app/components/figma/TrailMap.tsx`

SVG winding path component for the detail page. Props: `totalCourses`, `completedCount`, `currentIndex`. Renders:
- A winding SVG bezier path across full width
- Waypoint circles: filled brand for completed, pulsing animated for current, outlined muted for upcoming
- "CURRENT" label badge on active waypoint

### Step 4: Redesign LearningPaths.tsx (List Page)
**File**: `src/app/pages/LearningPaths.tsx`

Replace `PathCard` component with new design:
- Gradient header area (128px height) using `PathCardHeader`
- `PathProgressRing` overlapping the header/content boundary (absolute positioned, -top-12)
- Course count badge below ring
- Title, description, metadata preserved
- Overlapping course thumbnail avatars at bottom (use `thumbnailUrls` from store — need to load them)
- Status differentiation: `opacity-70` for 0% paths, green overlay for 100% paths
- Keep all existing: dropdown menu, dialogs, search, empty states, motion animations

Data changes needed:
- Load `thumbnailUrls` from `useCourseImportStore` to show course avatars on list cards
- Need to get first few course thumbnails per path from entries

### Step 5: Redesign LearningPathDetail.tsx (Detail Page)
**File**: `src/app/pages/LearningPathDetail.tsx`

Major layout restructure — change from single-column to two-column with sidebar:

**Header section** (full width):
- Back link (keep existing)
- Large title (text-4xl md:text-5xl font-extrabold)
- Stats row: hours studied, lessons completed, streak info
- Large percentage display on right side

**Trail Map section** (full width):
- `TrailMap` component showing journey progress

**Main content (lg:col-span-8)**:
- Hero "Now Learning" card: the first in-progress course gets a large card with thumbnail, title, author, progress bar, "Continue Learning" button, next lesson teaser
- Completed courses: horizontal scrollable strip with compact cards (thumbnail + green checkmark + title)
- Keep drag-drop reorder capability for the full course list (accessible via "View Full Curriculum" button or edit mode)

**Sidebar (lg:col-span-4)**:
- "Coming Up Next" card with upcoming (not-started) courses
- "Suggest Order" AI button (move from header to sidebar)
- "Daily Tip" card — new static motivational component

Preserve all existing:
- DnD reorder (SortableContext, DndContext)
- Course picker dialog
- AI suggest order dialog
- Remove course functionality
- Move up/down buttons

### Step 6: Build verification

```bash
npm run build
npm run lint
npx tsc --noEmit
```

## Files to Create
- `src/app/components/figma/PathProgressRing.tsx`
- `src/app/components/figma/PathCardHeader.tsx`
- `src/app/components/figma/TrailMap.tsx`

## Files to Modify
- `src/app/pages/LearningPaths.tsx`
- `src/app/pages/LearningPathDetail.tsx`

## Verification
1. `npm run build` — zero errors
2. `npm run dev` — visually verify both pages in browser
3. All existing functionality works: create/rename/delete paths, add/remove/reorder courses, AI suggest order, search/filter
4. Light and dark mode both render correctly (design tokens handle theming)
5. Responsive: mobile (1 col), tablet (2 col), desktop (3 col) on list page
6. Keyboard accessibility maintained (tab order, aria labels)
