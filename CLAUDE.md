# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EduVi is a personal learning platform featuring progress tracking, study streaks, course management, and achievement analytics. Originally designed from Figma wireframes, it's evolved into a comprehensive learning dashboard with six main sections: Overview, My Class, Courses, Instructors, Reports, and Settings.

Original Figma design: https://www.figma.com/design/q4x6ttJD11avObQNFoeQ2D/E-learning-platform-wireframes (design foundation)

## Development Commands

- `npm i` - Install dependencies
- `npm run dev` - Start Vite development server (default: http://localhost:5173)
- `npm run build` - Build production bundle with Vite

**Worktree E2E Warning:** Before running E2E tests in a git worktree, kill any dev server on port 5173 (`lsof -ti:5173 | xargs kill`). Playwright's `reuseExistingServer: true` will silently reuse a dev server from the main workspace, causing tests to pass against stale code.

## Architecture

### Tech Stack

- **Framework**: React 19.2.4 with TypeScript
- **Build Tool**: Vite 6.4.1
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **Routing**: React Router v7
- **UI Components**: shadcn/ui components (Radix UI primitives)
- **Icons**: Lucide React

### File Structure

```
src/
├── main.tsx                    # App entry point
├── app/
│   ├── App.tsx                 # Root component with RouterProvider
│   ├── routes.tsx              # React Router configuration
│   ├── components/
│   │   ├── Layout.tsx          # Main layout with sidebar + header
│   │   ├── figma/              # Custom Figma-exported components
│   │   └── ui/                 # shadcn/ui component library (~50 components)
│   └── pages/                  # Route page components
│       ├── Overview.tsx
│       ├── MyClass.tsx
│       ├── Courses.tsx
│       ├── Instructors.tsx
│       ├── Reports.tsx
│       └── Settings.tsx
└── styles/
    ├── index.css               # Main CSS entry (imports all styles)
    ├── tailwind.css            # Tailwind v4 configuration
    ├── theme.css               # CSS custom properties for theming
    └── fonts.css               # Font definitions

docs/
├── analysis/                   # Analysis documents
├── api/                        # API documentation and Mockoon data
├── docker/                     # Docker setup guides
├── implementation-artifacts/   # Story files, sprint tracking
├── planning-artifacts/         # Product briefs, epics, planning docs
├── plans/                      # Implementation plans
├── reviews/                    # Design and code review reports
│   ├── design/                 # Design review reports
│   └── code/                   # Code review reports
└── research/                   # Technical research

scripts/                        # Test and automation scripts
├── auto-story.py              # Story automation orchestrator
├── burn-in.sh                 # E2E test burn-in validation
├── ci-local.sh                # Local CI environment simulation
├── test-api.sh                # API testing script
└── test-changed.sh            # Run tests for changed files
```

### Import Alias

The `@` alias resolves to `./src` (configured in vite.config.ts):
```typescript
import { Button } from '@/app/components/ui/button'
```

### Routing Architecture

React Router v7 with nested routes. Layout component wraps all pages and provides:
- Left sidebar navigation with active state management
- Top header with search bar, notifications, and user profile
- Main content area via `<Outlet />`

All routes defined in [src/app/routes.tsx](src/app/routes.tsx).

## Key Conventions

- Page components are route-level components in [src/app/pages/](src/app/pages/)
- Reusable UI components live in [src/app/components/ui/](src/app/components/ui/)
- Custom Figma components in [src/app/components/figma/](src/app/components/figma/)
- All styling uses Tailwind utility classes
- Icons from lucide-react
- Images primarily from Unsplash (see ATTRIBUTIONS.md)

## Project Rules

Detailed instructions are organized in `.claude/rules/` with smart path-specific loading:

### Universal Rules (Always Loaded)

- **[styling.md](.claude/rules/styling.md)** — Design tokens, Tailwind CSS v4, UI component library
- **[automation.md](.claude/rules/automation.md)** — ESLint rules, git hooks, review agents (12 mechanisms)
- **[workflows/story-workflow.md](.claude/rules/workflows/story-workflow.md)** — `/start-story`, `/review-story`, `/finish-story` commands

### Path-Specific Rules (Loaded Conditionally)

**When working on tests:**
- **[testing/test-patterns.md](.claude/rules/testing/test-patterns.md)** — E2E test patterns, deterministic time, IndexedDB seeding
- **[testing/test-cleanup.md](.claude/rules/testing/test-cleanup.md)** — Playwright context isolation, factory pattern

**When working on UI:**
- **[workflows/design-review.md](.claude/rules/workflows/design-review.md)** — Design review workflow, accessibility, responsive design

### Verify Loaded Rules

Use `/memory` to see which rules are currently active based on the files you're working on.

### Quick Access

- **All Rules Index**: [.claude/rules/README.md](.claude/rules/README.md)
- **Automation Status**: [automation-infrastructure-status-2026-03-13.md](docs/implementation-artifacts/automation-infrastructure-status-2026-03-13.md)
- **Engineering Patterns**: [engineering-patterns.md](docs/engineering-patterns.md)

## Maintaining CLAUDE.md

When I make a mistake due to missing context:
1. Fix the immediate issue
2. Suggest adding the correction to CLAUDE.md or `.claude/rules/*.md` (whichever is appropriate)
3. Keep entries concise (prefer file:line references over code examples)

**Length Guidelines**:
- Root CLAUDE.md: Keep < 300 lines (currently ~250)
- `.claude/rules/*.md`: No limit, but prefer splitting large files
- Use path-specific frontmatter in rules to control when they load

## Auto-Story Script Configuration

The `scripts/auto-story.py` autonomous batch workflow uses increased buffer size (10MB) for complex feature implementations.

**Why This Matters:**
- Epic 9+ stories (vector search, RAG, embeddings) generate verbose AI outputs exceeding the default 1MB limit
- Claude Agent SDK enforces JSON message buffer limits during subprocess communication
- Without increased buffer, implementation sessions fail with buffer overflow errors

**Configuration** ([scripts/auto-story.py:476](scripts/auto-story.py#L476)):
```python
max_buffer_size=10 * 1024 * 1024,  # 10MB buffer (Epic 9B AI features exceed 1MB default)
```

**Troubleshooting Buffer Overflows:**
- If 10MB is still insufficient, increase to 20MB or 50MB
- Check logs for `ClaudeAgentOptions configured with XMB message buffer` (debug level)
- Consider splitting exceptionally complex stories into smaller subtasks

## References

**Official Documentation:**
- [Claude Code Memory](https://docs.anthropic.com/en/docs/claude-code/memory)
- [Path-Specific Rules](https://paddo.dev/blog/claude-rules-path-specific-native/)

**Project Documentation:**
- [Story Template](docs/implementation-artifacts/story-template.md)
- [Sprint Status](docs/implementation-artifacts/sprint-status.yaml)
- [Design Principles](.claude/workflows/design-review/design-principles.md)
