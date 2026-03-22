---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - '/Users/pedro/.claude/plans/jazzy-kindling-kettle.md'
  - '_bmad-output/planning-artifacts/architecture.md'
project_name: 'Knowlune'
user_name: 'Pedro'
date: '2026-03-22'
---

# Knowlune UX Overhaul - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Knowlune UX Overhaul, transforming it from a Chase Hughes-specific content player into a general-purpose learning platform centered on user-imported content.

## Requirements Inventory

### Functional Requirements

FR1: Courses page subtitle must not contain hardcoded author/product branding
FR2: Navigation label "My Classes" renamed to "My Courses" across all surfaces (sidebar, mobile bar, search palette)
FR3: Navigation label "Instructors" renamed to "Authors" across all surfaces
FR4: Sidebar restructured into 3 groups: Library (Overview, Courses, Learning Paths, Authors), Study (My Courses, Notes, Review), Track (Challenges, Knowledge Gaps, Retention, Session History, Reports)
FR5: Knowledge Gaps, Retention, and Session History pages merged into Reports as lazy-loaded tabs
FR6: Old routes (`/knowledge-gaps`, `/retention`, `/session-history`) redirect to `/reports?tab=<name>`
FR7: Authors page shows featured profile layout when only 1 author exists
FR8: Pre-seeded courses de-emphasized on Courses page (collapsed/secondary section)
FR9: Author data model with name, bio, photo, specialties, social links, stored in IndexedDB
FR10: Author CRUD operations (create, read, update, delete) via dialog UI
FR11: Authors page displays both pre-seeded and user-created authors from IndexedDB
FR12: Author auto-detection from folder name patterns during import
FR13: Imported courses can be linked to an author via authorId
FR14: Course import uses a multi-step wizard (folder -> details -> tags/cover -> learning path -> confirm)
FR15: Import wizard allows editing course name, author, description, difficulty, category
FR16: AI generates metadata suggestions (category, difficulty, description) during import
FR17: Course metadata editable after import via edit dialog
FR18: Video order within imported courses can be reordered via drag-and-drop
FR19: Multiple named learning paths can be created, each with name and description
FR20: Learning paths support both pre-seeded and imported courses
FR21: AI suggests learning path placement based on content analysis
FR22: Drag-drop visual editor for reordering courses within a path
FR23: Progress tracking aggregated per learning path
FR24: Onboarding redesigned as 4-step import-focused flow (welcome -> import -> study -> goal)
FR25: Sidebar items progressively disclosed based on user data thresholds

### NonFunctional Requirements

NFR1: All UI changes maintain WCAG 2.1 AA+ (4.5:1 contrast, keyboard navigation, semantic HTML)
NFR2: Reports tabs lazy-loaded - only active tab mounts its component
NFR3: No hardcoded Tailwind colors (ESLint design-tokens/no-hardcoded-colors enforced)
NFR4: Route changes preserve backwards compatibility via redirects
NFR5: Dexie schema migrations non-destructive (existing data preserved)
NFR6: All changes pass build, lint, and unit tests before merge

### Additional Requirements

- Existing Dexie schema is at v18 - new tables must use v19+
- Zustand stores follow optimistic update + rollback pattern
- All imports use `@/` alias
- Component library: 50+ shadcn/ui components (reuse, don't reinvent)
- File System Access API (Chrome/Edge only) for course import
- Design tokens from theme.css - never hardcode colors
- Route paths: label changes only, existing paths preserved for backwards compatibility

### UX Design Requirements

UX-DR1: Sidebar groups balanced (Library 4, Study 3, Track 5) to reduce cognitive overload
UX-DR2: Mobile bottom nav retains 4 primary items (Overview, My Courses, Courses, Notes)
UX-DR3: Authors page single-author state uses featured profile layout (larger avatar, full bio, course list)
UX-DR4: Import wizard uses stepper UI pattern with clear step indicators
UX-DR5: Pre-seeded courses de-emphasized (collapsed section, smaller treatment) rather than spotlighted
UX-DR6: Progressive sidebar disclosure shows "New" badge when items first unlock
UX-DR7: Empty states explain feature value, show preview of populated state, provide clear CTA
UX-DR8: Onboarding overlay uses step dots, escape-to-skip, motion transitions

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | E23 | Remove hardcoded branding |
| FR2 | E23 | Rename My Classes -> My Courses |
| FR3 | E23 | Rename Instructors -> Authors |
| FR4 | E23 | Sidebar restructure (Library/Study/Track) |
| FR7 | E23 | Featured single-author layout |
| FR8 | E23 | De-emphasize pre-seeded courses |
| FR14 | E24 | Multi-step import wizard |
| FR15 | E24 | Import wizard metadata fields |
| FR16 | E24 | AI metadata suggestions |
| FR17 | E24 | Post-import editing dialog |
| FR18 | E24 | Video reorder via DnD |
| FR9 | E25 | Author data model |
| FR10 | E25 | Author CRUD dialog |
| FR11 | E25 | Authors page from IndexedDB |
| FR12 | E25 | Author auto-detection |
| FR13 | E25 | Link courses to authors |
| FR24 | E25 | Import-focused onboarding |
| FR25 | E25 | Progressive sidebar disclosure |
| FR19 | E26 | Multiple named learning paths |
| FR20 | E26 | Mixed course types in paths |
| FR21 | E26 | AI path placement |
| FR22 | E26 | Drag-drop path editor |
| FR23 | E26 | Per-path progress tracking |
| FR5 | E27 | Reports tab consolidation |
| FR6 | E27 | Route redirects to Reports tabs |

## Epic List

### Epic 23: Platform Identity & Navigation Cleanup
Users experience Knowlune as a general-purpose learning platform with clean, logically grouped navigation — not a content player for a specific author.
**FRs covered:** FR1, FR2, FR3, FR4, FR7, FR8
**NFRs addressed:** NFR1, NFR3, NFR6

### Epic 24: Course Import Wizard & Editing
Importing a course is a guided, metadata-rich experience. Users can capture author name, description, difficulty, category, tags, and cover image during import, and edit or reorder content after.
**FRs covered:** FR14, FR15, FR16, FR17, FR18
**NFRs addressed:** NFR1, NFR3, NFR5
**Note:** Uses simple `authorName: string` text field — no Author entity dependency.

### Epic 25: Author Management & New User Experience
Authors are first-class entities users can create and manage with real photos. New users get a clear, guided introduction with progressive feature discovery. Upgrades E24's simple authorName to full Author entity with CRUD, auto-detection, and profiles.
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR24, FR25
**NFRs addressed:** NFR1, NFR3, NFR5

### Epic 26: Multi-Path Learning Journeys
Users can create multiple named learning paths mixing any courses, with AI-suggested placement and visual drag-drop editing. Per-path progress tracking shows aggregate completion.
**FRs covered:** FR19, FR20, FR21, FR22, FR23
**NFRs addressed:** NFR1, NFR5

### Epic 27: Analytics Consolidation
Users get a unified analytics hub with Knowledge Gaps, Retention, and Session History accessible as tabs within Reports. Sidebar links remain as direct access points for power users.
**FRs covered:** FR5, FR6
**NFRs addressed:** NFR2, NFR4

## Dependency Graph

```
E23 (Platform Identity) - no dependencies
  |
  +---> E24 (Import Wizard) - uses simple authorName string
         |
         +---> E25 (Authors + New User Experience) - upgrades authorName to full entity
                |
                +---> E26 (Learning Paths) - benefits from rich courses
                       |
                       +---> E27 (Analytics Consolidation)

E25 onboarding/sidebar stories can start in parallel with Author stories
```

## Dexie Schema Version Chain

| Epic | Version | Changes |
|------|---------|---------|
| E24 | v19 | `authorName`, `difficulty`, `description` fields on `importedCourses` |
| E25 | v20 | `authors` table, `authorId` field on `importedCourses`, Chase Hughes seeded |
| E26 | v21 | `learningPaths` + `learningPathEntries` tables, old `learningPath` migrated + dropped |
| E27 | — | No schema changes |

---

## Epic 23: Platform Identity & Navigation Cleanup

Users experience Knowlune as a general-purpose learning platform with clean, logically grouped navigation — not a content player for a specific author.

### Story 23.1: Remove Hardcoded Branding from Courses Page

As a **learner**,
I want the Courses page to show a generic library description instead of a specific author's name,
So that the app feels like my personal learning platform, not someone else's content player.

**Acceptance Criteria:**

**Given** the user navigates to the Courses page
**When** the page renders
**Then** the subtitle displays "Your learning library — {totalCount} courses" (or similar generic text)
**And** no hardcoded references to "Chase Hughes" or "The Operative Kit" appear in any UI-facing text across the app
**And** author data files (`chase-hughes.ts`, course definition files) retain the author's name as course/instructor metadata

### Story 23.2: Rename "My Classes" to "My Courses"

As a **self-directed learner**,
I want the navigation to say "My Courses" instead of "My Classes",
So that the terminology matches self-directed learning rather than a school/LMS context.

**Acceptance Criteria:**

**Given** the app renders the sidebar navigation
**When** the user views the navigation items
**Then** "My Classes" is displayed as "My Courses" in the sidebar, mobile bottom bar, and search command palette
**And** the route path remains `/my-class` for backwards compatibility
**And** the page title inside MyClass.tsx reads "My Courses"

### Story 23.3: Rename "Instructors" to "Authors"

As a **learner**,
I want the navigation and pages to say "Authors" instead of "Instructors",
So that the terminology is appropriate for any learning content, not just formal instruction.

**Acceptance Criteria:**

**Given** the app renders the sidebar navigation
**When** the user views the navigation items
**Then** "Instructors" is displayed as "Authors" in the sidebar, mobile overflow drawer, and search command palette
**And** the Instructors page title reads "Authors" with updated subtitle
**And** the InstructorProfile breadcrumb and "not found" text say "Author"
**And** a `/authors` route alias redirects to `/instructors`
**And** internal TypeScript types and variable names remain as `Instructor` (renamed in future epic)

### Story 23.4: Restructure Sidebar Navigation Groups

As a **learner**,
I want the sidebar organized into logical groups (Library, Study, Track),
So that I can quickly find features based on what I'm trying to do.

**Acceptance Criteria:**

**Given** the app renders the sidebar navigation
**When** the user views the navigation groups
**Then** the groups are: Library (Overview, Courses, Learning Paths, Authors), Study (My Courses, Notes, Review), Track (Challenges, Knowledge Gaps, Retention, Session History, Reports)
**And** the "Connect" group no longer exists
**And** the mobile bottom bar shows Overview, My Courses, Courses, Notes as the 4 primary items
**And** all other items appear in the mobile "More" drawer
**And** keyboard shortcuts and accessibility (focus order, ARIA labels) work correctly with the new structure

### Story 23.5: De-emphasize Pre-seeded Courses

As a **learner**,
I want imported courses to be the primary focus on the Courses page,
So that my own content takes center stage over pre-installed courses.

**Acceptance Criteria:**

**Given** the user navigates to the Courses page
**When** the page renders with both imported and pre-seeded courses
**Then** imported courses appear first and prominently
**And** pre-seeded courses appear in a secondary section below with a collapsible header (e.g., "Pre-installed Courses")
**And** the pre-seeded section is collapsed by default if the user has 1+ imported courses
**And** the pre-seeded section is expanded by default if the user has 0 imported courses
**And** the collapse state persists across sessions (localStorage)
**Given** a filter chip is active that matches pre-seeded courses
**When** the pre-seeded section is collapsed
**Then** the section auto-expands to show matching results

### Story 23.6: Featured Author Layout for Single-Author State

As a **learner**,
I want the Authors page to show a rich featured profile when there's only one author,
So that the page feels intentional and informative rather than sparse and broken.

**Acceptance Criteria:**

**Given** the Authors page has only 1 author
**When** the page renders
**Then** it shows a featured profile layout with larger avatar, full bio, specialties, social links, and their course list
**And** a teaser CTA reads "Authors are automatically detected when you import courses"
**Given** the Authors page has 2+ authors
**When** the page renders
**Then** it shows the existing grid card layout (no change to multi-author behavior)

---

## Epic 24: Course Import Wizard & Editing

Importing a course is a guided, metadata-rich experience. Users can capture author name, description, difficulty, category, tags, and cover image during import, and edit or reorder content after.

### Story 24.1: Refactor Import Function into Scan and Persist

As a **developer** (enabler story),
I want the import function split into `scanCourseFolder()` and `persistImportedCourse()`,
So that the import wizard can collect user input between scanning files and saving the course.

**Acceptance Criteria:**

**Given** the existing `importCourseFromFolder()` function in `courseImport.ts`
**When** the refactor is complete
**Then** `scanCourseFolder(dirHandle)` returns `{ videos, pdfs, folderName }` without persisting anything
**And** `persistImportedCourse(metadata, videos, pdfs)` writes to Dexie + Zustand atomically
**And** the Courses page import button continues to call the existing one-click flow (wizard replaces it in Story 24.2)
**And** all existing import tests pass without modification
**And** the `ImportedCourse` type is extended with optional fields: `authorName?: string`, `difficulty?: Difficulty`, `description?: string`
**And** a Dexie v19 migration adds `authorName`, `difficulty`, `description` as optional fields to `importedCourses` table

### Story 24.2: Import Wizard — Folder Selection & Course Details

As a **learner**,
I want a guided wizard when importing a course that lets me review and enrich course details,
So that my imported courses have meaningful metadata from the start.

**Acceptance Criteria:**

**Given** the user clicks "Import Course" on the Courses page
**When** the folder picker completes and files are scanned
**Then** duplicate detection runs immediately — if a course with the same name exists, an error toast appears and the wizard does not open
**And** a brief scan summary shows file counts ("Found 12 videos, 3 PDFs") before the wizard steps begin
**And** a multi-step wizard dialog opens (stepper UI with step indicators)
**And** Step 1 (Course Details) shows:
  - Course name (pre-filled from folder name, editable)
  - Author name (text field, pre-filled if auto-detected from folder path pattern like `Author - Title`)
  - Description (text area, empty by default)
  - Difficulty selector (beginner / intermediate / advanced, default: none selected)
  - Category (combobox with existing categories from other courses + free-form entry)
**And** the user can navigate Back (cancels import) or Next
**And** all fields are optional except course name
**And** the dialog is keyboard navigable and meets WCAG AA

### Story 24.3: Import Wizard — Tags, Cover Image & Confirmation

As a **learner**,
I want to review AI-suggested tags, set a cover image, and confirm before importing,
So that I have full control over how my course appears in the library.

**Acceptance Criteria:**

**Given** the user completes Step 1 (Course Details) and clicks Next
**When** Step 2 (Tags & Cover) renders
**Then** auto-analysis (tag generation) runs after scan, before Step 2 renders — tags populate as they arrive
**And** it shows:
  - Tags: AI-generated suggestions displayed as editable chips (add/remove), with "Generating..." state if AI is processing
  - Cover image: auto-extracted thumbnail from first video, with options to upload from device or paste a URL
**And** if AI is not configured, tags section shows empty chips with manual "Add tag" input and a note "Configure AI in Settings for automatic suggestions"
**And** clicking Next shows Step 3 (Confirmation) with a summary card of all metadata
**And** clicking "Import" on the confirmation step calls `persistImportedCourse()` with all collected metadata
**And** after persist, the legacy `triggerAutoAnalysis()` does NOT fire (wizard already handled it)
**And** a success toast shows and the wizard closes
**And** clicking Back on any step returns to the previous step without losing entered data
**And** closing the wizard at any point cancels the import (no data persisted)

### Story 24.4: AI Metadata Suggestions During Import

As a **learner**,
I want AI to suggest category, difficulty, and description based on my course content,
So that I can enrich my courses with minimal manual effort.

**Acceptance Criteria:**

**Given** the user is on Step 1 (Course Details) of the import wizard
**When** AI is configured and enabled in Settings
**Then** a "Suggest with AI" button appears next to category, difficulty, and description fields
**And** clicking it sends course context (name, file names, video/PDF counts) to the AI provider
**And** AI returns suggested values that auto-fill the fields (user can edit or override)
**And** a loading indicator shows while AI is processing (with 30s timeout)
**Given** AI is not configured or the request fails
**When** the user clicks "Suggest with AI"
**Then** a helpful message explains AI is not configured, with a link to Settings
**And** all fields remain manually editable regardless of AI availability

### Story 24.5: Post-Import Course Editing Dialog

As a **learner**,
I want to edit my imported course's metadata after import,
So that I can fix mistakes or add information I didn't have during import.

**Acceptance Criteria:**

**Given** an imported course exists in the library
**When** the user opens the course card dropdown menu or course detail page
**Then** an "Edit Details" option is available
**And** clicking it opens a dialog with the same fields as the import wizard (name, author name, description, difficulty, category, tags, cover image)
**And** all fields are pre-populated with current values
**And** saving updates the course in Dexie and Zustand (optimistic update with rollback on failure)
**And** a success toast confirms the update
**And** the course card/detail page immediately reflects the changes
**And** the "AI Suggest" option is also available in the edit dialog

### Story 24.6: Video Drag-and-Drop Reorder

As a **learner**,
I want to reorder videos within an imported course by dragging and dropping,
So that I can organize the viewing sequence to match my preferred learning order.

**Acceptance Criteria:**

**Given** the user is viewing an imported course detail page
**When** the course has 2+ videos
**Then** a drag handle appears on each video row
**And** the user can drag videos to reorder them
**And** the new order persists to Dexie (updates `order` field on `ImportedVideo` records)
**And** the reorder is accessible via keyboard (move up/move down buttons as alternative to drag)
**And** a "Reset to Original Order" option restores the filesystem scan order
**Given** the course has 0 or 1 video
**When** the detail page renders
**Then** no drag handles or reorder controls are shown

---

## Epic 25: Author Management & New User Experience

Authors are first-class entities users can create and manage with real photos. New users get a clear, guided introduction with progressive feature discovery. Upgrades E24's simple authorName to full Author entity with CRUD, auto-detection, and profiles.

### Story 25.1: Author Data Model & Migration

As a **developer** (enabler story),
I want an Author entity in IndexedDB with a Dexie v20 migration,
So that authors can be stored, queried, and linked to courses.

**Acceptance Criteria:**

**Given** the app starts with Dexie schema v19 (from E24)
**When** the v20 migration runs
**Then** an `authors` table is created with `id` primary key and `name` index
**And** Chase Hughes is seeded as an Author record from the existing static data
**And** an `authorId` field is added to `importedCourses` table
**And** existing imported courses with `authorName` strings are migrated: case-insensitive, trimmed dedup — "john", "John", " John " all map to one Author record
**And** a toast summarizes the migration: "Created N author profiles from your courses"
**And** the migration is wrapped in try/catch — on failure, the app loads without author features (graceful degradation, error logged)
**And** the `Author` interface includes: `id`, `name`, `bio?`, `photoUrl?`, `specialties[]`, `socialLinks?`, `isPreseeded`, `createdAt`, `updatedAt`
**And** a `useAuthorStore` Zustand store is created with `loadAuthors()`, `getAuthorById()`, and CRUD methods
**And** existing data is preserved — no data loss during migration
**And** migration is tested with edge cases: 0 courses, 100+ courses, duplicate authorNames, empty authorName strings, unicode names

### Story 25.2: Author CRUD Dialog

As a **learner**,
I want to create, edit, and delete author profiles with name, bio, photo, and specialties,
So that I can organize my course library by who created the content.

**Acceptance Criteria:**

**Given** the user opens the "Create Author" or "Edit Author" dialog
**When** the dialog renders
**Then** it shows fields for: name (required), bio (optional, max 500 chars), specialties (tag chips, add/remove), website URL (optional), social links (optional)
**And** a photo section with three options:
  1. **Initials fallback** (default) — generated from author name, displayed on `bg-brand/10` circle
  2. **Upload from device** — file picker or drag-drop accepting JPG/PNG/WebP, with crop tool (reuses Settings avatar crop pattern), max 2MB file size enforced
  3. **Paste URL** — input field for a URL to the author's photo (fetches and stores locally)
**And** saving creates/updates the Author record in Dexie and Zustand (optimistic update with rollback)
**And** a success toast confirms the action
**And** the dialog is keyboard navigable and meets WCAG AA
**And** photo is resized/compressed to standard avatar size before storage

**Delete behavior:**
**Given** the user clicks "Delete Author" on an existing author
**When** a confirmation dialog appears explaining the consequence
**Then** the user must confirm before deletion proceeds
**And** on deletion, all courses linked to this author get `authorId: null`
**And** those courses display "Unknown Author" in their cards and detail pages
**And** pre-seeded authors (`isPreseeded: true`) cannot be deleted — the delete button is hidden for them

### Story 25.3: Authors Page from IndexedDB

As a **learner**,
I want the Authors page to show all authors from the database (pre-seeded and user-created),
So that I see a complete view of all content creators in my library.

**Acceptance Criteria:**

**Given** the Authors page loads
**When** the `useAuthorStore` has loaded authors from IndexedDB
**Then** all authors (pre-seeded + user-created) display in the grid
**And** each author card shows: avatar (photo or initials), name, specialties (max 3 + "+N more"), course count, total content hours
**And** clicking an author card navigates to the author detail page
**And** a "Add Author" button opens the Create Author dialog (Story 25.2)
**And** the single-author featured layout from E23 (Story 23.6) still applies when only 1 author exists
**And** the static `allInstructors` import is replaced with `useAuthorStore` data
**And** `InstructorProfile.tsx` is refactored to read from `useAuthorStore` instead of static data — breadcrumbs, bio, courses, and stats all sourced from IndexedDB
**And** the `getInstructorStats()` function is adapted to work with the new Author entity
**And** a skeleton loading state shows while `useAuthorStore` is loading (existing pattern)
**Given** `useAuthorStore` returns 0 authors (migration failed or empty DB)
**When** the page renders
**Then** it falls back to static `allInstructors` data as a safety net

### Story 25.4: Author Auto-Detection During Import

As a **learner**,
I want the import wizard to automatically detect the author from the course folder name and match against existing authors,
So that I don't have to manually type or re-create author profiles for well-organized course folders.

**Acceptance Criteria:**

**Given** the user selects a folder during course import (E24 wizard)
**When** the folder name matches a known pattern (`Author - Title`, `Author/Title`, `[Author] Title`)
**Then** the detected author name is pre-filled in the wizard's author field with a "(detected)" label so the user knows to verify
**And** this extends E24's basic folder name string extraction with Author record matching from the database
**And** if a matching Author record exists (case-insensitive fuzzy match by name), it is pre-selected with a "(Matched)" indicator
**And** if no match exists, the field shows the detected name with a prominent "Create as new author" option
**Given** the folder name does not match any known pattern (e.g., "My Documents - Backup")
**When** the wizard opens
**Then** the author field is empty (user can type manually or skip)
**And** detection only triggers for patterns with high confidence — generic folder names are NOT parsed
**And** the detection logic is unit tested with at least 10 folder name patterns including edge cases (hyphens, dots, nested folders, unicode, false positives like "My Files - 2024")

### Story 25.5: Smart Author Photo Detection from Course Folder

As a **learner**,
I want the system to find an author's photo from the course folder during import,
So that author profiles have real photos without me having to search for them manually.

**Acceptance Criteria:**

**Given** the user imports a course folder
**When** the folder scan completes
**Then** the system searches for common author image patterns: `author.jpg`, `author.png`, `instructor.jpg`, `instructor.png`, `about/author.*`, `about/instructor.*`, `bio.*`, `profile.*` (case-insensitive)
**And** if a matching image is found, it is shown as a preview in the import wizard with an explicit "Use as author photo?" confirmation button — never auto-applied
**And** clicking the button associates the image with the Author record (creates one if needed)
**And** the image is resized/compressed to standard avatar size before storage
**Given** no author image is found in the course folder
**When** the wizard renders
**Then** no suggestion is shown — the author uses initials fallback or the user can upload/paste manually

### Story 25.6: Link Imported Courses to Author Profiles

As a **learner**,
I want to link my imported courses to author profiles,
So that I can browse all courses by a specific author.

**Acceptance Criteria:**

**Given** the user is editing an imported course (via E24's edit dialog)
**When** the author field is displayed
**Then** it is upgraded from a simple text field to a combobox that searches existing Author records by name
**And** the user can select an existing author or type a new name to create one inline
**And** selecting an author sets `authorId` on the `ImportedCourse` record
**And** the author detail page shows all linked courses (pre-seeded via `instructorId` and imported via `authorId`)
**And** courses with `authorId: null` display "Unknown Author"
**And** changing the author on a course updates the course card and detail page immediately

### Story 25.7: Import-Focused Onboarding Overlay

As a **new user**,
I want a guided 4-step onboarding when I first open the app,
So that I understand what Knowlune does and how to get started.

**Acceptance Criteria:**

**Given** the user opens the app for the first time (onboarding not yet completed)
**When** the app loads
**Then** an onboarding overlay appears with step dots, close/skip button, and escape-to-skip

**Step 1 — Welcome:**
**Given** the overlay is on step 1
**Then** it shows "Welcome to Knowlune — Your Personal Learning Studio" with a brief explanation: "Import courses from your computer, track progress, and let AI help you learn smarter"
**And** a "Get Started" button advances to step 2

**Step 2 — Import Your First Course:**
**Given** the overlay is on step 2
**Then** it shows "Add a folder with video lessons or PDFs" with a CTA directing to the Courses page
**And** the step auto-advances when the first course is imported (checks current state on mount before subscribing — if already imported, advances immediately)

**Step 3 — Start Studying:**
**Given** the overlay is on step 3
**Then** it shows "Open a lesson and start watching"
**And** the step auto-advances after 5 seconds of video playback

**Step 4 — Set a Goal (optional):**
**Given** the overlay is on step 4
**Then** it shows "Create a learning challenge to stay motivated"
**And** a "Skip — I'll do this later" option is available
**And** the step auto-advances when a challenge is created OR when user clicks skip

**Completion:**
**Given** all steps are complete or skipped
**Then** a celebration screen shows "You're all set!" with confetti animation
**And** completion is persisted to localStorage (never shown again)
**And** no mention of bundled/pre-seeded courses appears anywhere in the onboarding

### Story 25.8: Progressive Sidebar Disclosure

As a **new user**,
I want the sidebar to show only relevant items based on my activity,
So that I'm not overwhelmed by features I can't use yet.

**Acceptance Criteria:**

**Given** the sidebar renders for a user who installed the app AFTER E25 shipped (new user)
**When** the user's data state is evaluated
**Then** items are shown/hidden based on these thresholds:

| Item | Visible When |
|------|-------------|
| Overview | Always |
| Courses | Always |
| My Courses | Always |
| Notes | Always |
| Authors | Always |
| Challenges | Always |
| Settings | Always |
| Learning Paths | 2+ courses exist (pre-seeded or imported) |
| Review | 1+ review records exist |
| Reports | 1+ study session completed |
| Knowledge Gaps | 1+ imported courses exist |
| Retention | 1+ review records exist |
| Session History | 1+ study session completed |

**And** when an item first becomes visible, it appears with a subtle "New" badge (brand-soft background)
**And** the "New" badge disappears after the user visits the page once
**And** badge state persists in localStorage
**And** a new `useNavigationVisibility` hook evaluates thresholds reactively

**Given** the user completed onboarding BEFORE E25 shipped (existing user)
**When** the sidebar renders
**Then** ALL sidebar items are visible — no progressive disclosure applied (no regression for power users)
**And** this is determined by checking if a pre-E25 onboarding completion flag exists in localStorage

**And** the mobile "More" drawer also respects visibility conditions
**And** hidden items are still accessible via direct URL navigation (not blocked, just hidden from nav)

### Story 25.9: Empty State Improvements

As a **learner**,
I want consistent, helpful empty states across all pages,
So that I understand each feature's value and how to get started.

**Acceptance Criteria:**

**Given** a page has no data to display
**When** the empty state renders
**Then** it follows a consistent template:
  1. Icon representing the feature
  2. Title explaining what the feature does
  3. Description of what the page looks like with data
  4. Clear CTA button linking to the prerequisite action
  5. If the feature requires a prior action, a note explaining what's needed

**Pages to update (in priority order):**
1. My Courses (no courses started)
2. Notes (no notes created)
3. Courses (no imported courses — update existing)
4. Learning Paths (fewer than 2 courses)
5. Review (no review records)
6. Challenges (no challenges)
7. Reports (no study sessions)
8. Authors (no user-created authors — update existing teaser CTA)

**And** all empty states use the existing `EmptyState` component pattern
**And** all empty states use design tokens (no hardcoded colors)
**And** motion animations respect `prefers-reduced-motion`
**And** if time-constrained, pages 1-4 are mandatory; pages 5-8 can ship in a follow-up

---

## Epic 26: Multi-Path Learning Journeys

Users can create multiple named learning paths mixing any courses, with AI-suggested placement and visual drag-drop editing. Per-path progress tracking shows aggregate completion.

### Story 26.1: Multi-Path Data Model & Migration

As a **developer** (enabler story),
I want a multi-path learning path model in IndexedDB replacing the single-path system,
So that users can create and manage multiple named learning paths.

**Acceptance Criteria:**

**Given** the app starts with Dexie schema v20 (from E25)
**When** the v21 migration runs
**Then** a `learningPaths` table is created with `id` primary key
**And** a `learningPathEntries` table is created with `id` primary key, `[pathId+courseId]` compound index, and `pathId` index
**And** existing `learningPath` table data is migrated into a default path named "My Learning Path" with all entries preserved
**And** the `LearningPath` interface includes: `id`, `name`, `description?`, `createdAt`, `updatedAt`, `isAIGenerated`
**And** the `LearningPathEntry` interface includes: `id`, `pathId`, `courseId`, `courseType: 'preseeded' | 'imported'`, `position`, `justification?`, `isManuallyOrdered`
**And** `useLearningPathStore` is rewritten to support multi-path CRUD: `createPath()`, `renamePath()`, `deletePath()`, `addCourseToPath()`, `removeCourseFromPath()`, `reorderCourse()`
**And** the old single-path `learningPath` table is dropped after successful migration
**And** migration is wrapped in try/catch with graceful degradation on failure
**And** existing data is preserved — no data loss

### Story 26.2: Learning Path List View

As a **learner**,
I want to see all my learning paths, create new ones, and manage them,
So that I can organize my courses into multiple topic-focused journeys.

**Acceptance Criteria:**

**Given** the user navigates to the Learning Paths page
**When** the page renders
**Then** it shows a list/grid of all learning paths with: name, description, course count, aggregate completion %, last updated date
**And** a "Create Path" button opens a dialog to enter name and optional description
**And** each path card has a dropdown menu with: Rename, Edit Description, Delete
**And** deleting a path shows a confirmation dialog — deleting removes the path and all entries (courses themselves are NOT deleted)
**And** clicking a path card navigates to the path detail view (Story 26.3)
**Given** the user has 0 learning paths
**When** the page renders
**Then** an empty state shows explaining learning paths with a CTA to create one
**And** the page is keyboard navigable and meets WCAG AA

### Story 26.3: Path Detail View with Drag-Drop Editor

As a **learner**,
I want to view and reorder courses within a learning path using drag-and-drop,
So that I can control my learning sequence.

**Acceptance Criteria:**

**Given** the user opens a learning path detail view
**When** the page renders
**Then** it shows the path name, description, and an ordered list of courses
**And** each course row shows: position number, course thumbnail, title, author name, completion %, course type badge (pre-seeded or imported)
**And** drag handles allow reordering courses via drag-and-drop
**And** reordering updates `position` fields in Dexie and marks entries as `isManuallyOrdered: true`
**And** keyboard alternatives exist for reorder (move up/move down buttons)
**And** an "Add Course" button opens a course picker dialog showing all courses (pre-seeded + imported) not already in this path
**And** a "Remove" button on each row removes the course from the path (not the course itself)
**And** if the path has AI-generated justifications, each course shows a collapsible "Why this order?" with the justification text
**And** the detail view uses the existing DnD patterns from `AILearningPath.tsx`

### Story 26.4: AI Path Placement Suggestion

As a **learner**,
I want AI to suggest which learning path a course belongs in and where to place it,
So that I can organize courses intelligently without manual effort.

**Acceptance Criteria:**

**Given** the user imports a course via the E24 wizard
**When** AI is configured and enabled and 1+ learning paths exist
**Then** the import wizard from E24 is extended with a new Step 4 (Learning Path) inserted between Tags/Cover and Confirm — this step only appears if 1+ learning paths exist or AI is configured
**And** the wizard shows existing learning paths with an AI-suggested placement: which path and what position
**And** the suggestion includes a brief justification (e.g., "This course covers fundamentals — place it before Advanced Topics")
**And** the user can accept the suggestion, choose a different path/position, or skip ("Add later")
**And** a "Create new path" option is available if no existing path fits

**Given** the user is on the path detail view
**When** the path has 2+ courses
**Then** a "Suggest Order" button is available
**And** clicking it sends course metadata (titles, tags, categories, difficulty) to the AI provider
**And** AI returns a suggested sequence with justifications
**And** a confirmation dialog shows the proposed reorder — user can accept or dismiss
**And** accepting marks all entries as `isManuallyOrdered: false` with AI justifications

**Given** AI is not configured
**When** the user encounters AI features
**Then** a helpful message explains AI is not configured, with a link to Settings
**And** all manual path management features work without AI

### Story 26.5: Per-Path Progress Tracking

As a **learner**,
I want to see my aggregate progress for each learning path,
So that I can track how far I am through each learning journey.

**Acceptance Criteria:**

**Given** a learning path contains courses
**When** the path list view or detail view renders
**Then** aggregate completion % is calculated: total completed lessons across all path courses / total lessons across all path courses
**And** the calculation works for both pre-seeded courses (using `contentProgress` store) and imported courses (using `progress` table)
**And** the path list card shows a progress bar with percentage
**And** the path detail view shows: overall progress bar, completed/total courses count, estimated remaining hours
**And** progress updates reactively when the user completes lessons in any course within the path
**And** courses with 0% progress show "Not Started", 100% show "Completed" badge
**Given** a path has 0 courses
**When** it renders
**Then** progress shows "No courses added yet" instead of 0%

---

## Epic 27: Analytics Consolidation

Users get a unified analytics hub with Knowledge Gaps, Retention, and Session History accessible as tabs within Reports. Sidebar links remain as direct access points for power users.

### Story 27.1: Add Analytics Tabs to Reports Page

As a **learner**,
I want Knowledge Gaps, Retention, and Session History available as tabs within Reports,
So that I can access all my analytics from one unified hub.

**Acceptance Criteria:**

**Given** the user navigates to the Reports page
**When** the page renders
**Then** it shows 5 tabs: Study Analytics (default), AI Analytics, Knowledge Gaps, Retention, Session History
**And** each tab lazily loads its component using `React.lazy` — only the active tab's component is mounted
**And** tab state is managed via URL search params (`?tab=knowledge-gaps`, `?tab=retention`, `?tab=session-history`)
**And** the Reports page reads `?tab=` via `useSearchParams()` and passes it as the default active tab
**And** switching tabs updates the URL without a full page reload (replace, not push)
**And** the existing Study Analytics and AI Analytics tabs are unchanged in behavior
**And** KnowledgeGaps, RetentionDashboard, and SessionHistory components render correctly as embedded tabs (no duplicate page headers/padding)
**And** each tab's independent data loading (stores, useEffect) works correctly — no cross-tab data conflicts
**And** the tab bar is scrollable on mobile if it overflows

### Story 27.2: Route Redirects for Legacy Paths

As a **learner**,
I want my bookmarks and links to `/knowledge-gaps`, `/retention`, and `/session-history` to still work,
So that I don't lose access to pages I've bookmarked or linked to.

**Acceptance Criteria:**

**Given** the user navigates to `/knowledge-gaps`
**When** React Router processes the route
**Then** the user is redirected to `/reports?tab=knowledge-gaps` (using a redirect component with `replace`)
**And** the same applies to `/retention` → `/reports?tab=retention`
**And** the same applies to `/session-history` → `/reports?tab=session-history`
**And** the redirect uses `replace` (not `push`) so the old URL doesn't pollute browser history
**And** direct URL navigation works: typing `/reports?tab=retention` in the browser opens Reports with the Retention tab active
**And** E2E tests that navigate to the old routes are updated to use the new redirected URLs

### Story 27.3: Update Sidebar Links to Reports Tabs

As a **learner**,
I want the sidebar to link directly to the correct Reports tab for Knowledge Gaps, Retention, and Session History,
So that I can access these analytics with one click from the sidebar.

**Acceptance Criteria:**

**Given** the sidebar renders (after E23's restructure)
**When** the user views the Track group
**Then** Knowledge Gaps, Retention, and Session History sidebar items link to `/reports?tab=knowledge-gaps`, `/reports?tab=retention`, `/reports?tab=session-history` respectively
**And** clicking a sidebar link navigates to Reports with the correct tab active
**And** the active state indicator highlights correctly — when on `/reports?tab=knowledge-gaps`, the Knowledge Gaps sidebar item shows as active (not the Reports item)
**And** the Reports sidebar item shows as active when on `/reports` with no tab param or `?tab=study-analytics`
**And** mobile "More" drawer links behave identically
**And** progressive sidebar visibility conditions from E25 (Story 25.8) still apply to these items
