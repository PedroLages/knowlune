# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knowlune is a personal learning platform with 41+ pages spanning course management, book reading, flashcards, quizzes, AI-powered tutors, knowledge mapping, and progress analytics. Built with React 19, TypeScript, Vite, Tailwind CSS v4, and a local-first Dexie/IndexedDB backend with Supabase auth/sync.

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm i` | Install dependencies |
| `npm run dev` | Start Vite dev server (http://localhost:5173) |
| `npm run build` | Production build with Vite |
| `npm run lint` | ESLint across project (with `--cache`) |
| `npm run typecheck` | `tsc --noEmit` full type check (catches what esbuild misses) |
| `npm run format` | Prettier write on `src/**` |
| `npm run format:check` | Prettier check-only |
| `npm run test` | Vitest watch mode |
| `npm run test:unit` | Vitest single run with coverage |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run ci` | Full CI: `typecheck && lint && format:check && build && test:unit` |
| `npm run preview` | Vite preview (port 4173) |

**Worktree E2E Warning:** Before running E2E tests in a git worktree, kill any dev server on port 5173 (`lsof -ti:5173 | xargs kill`). Playwright's `reuseExistingServer: true` will silently reuse a dev server from the main workspace, causing tests to pass against stale code.

**E2E + RouteGuard:** Guarded routes (including `/library/:bookId/read`) need guest session or auth. The merged Playwright fixture [`tests/support/fixtures/local-storage-fixture.ts`](tests/support/fixtures/local-storage-fixture.ts) uses an **auto** `_knowluneE2eBrowserInit` so `sessionStorage` guest flags apply even when a test only requests `{ page }`. Specs that assert true anonymous `Landing` on `/` clear those keys in `beforeEach` (see [`tests/e2e/landing.spec.ts`](tests/e2e/landing.spec.ts)).

## Architecture

### Tech Stack

- **Framework**: React 19.2.4 with TypeScript
- **Build Tool**: Vite 6.4.1
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **Routing**: React Router v7
- **State Management**: Zustand 5 (~40+ stores in `src/stores/`)
- **Database**: Dexie/IndexedDB (local-first) with Supabase auth/sync
- **UI Components**: shadcn/ui components (Radix UI primitives)
- **Icons**: Lucide React
- **Forms**: react-hook-form + zod
- **AI**: Vercel AI SDK (multi-provider) + `@mlc-ai/web-llm` for local LLM

### File Structure

```
src/
├── main.tsx                    # App entry point
├── app/
│   ├── App.tsx                 # Root component with RouterProvider
│   ├── routes.tsx              # React Router configuration (~40+ routes)
│   ├── components/
│   │   ├── Layout.tsx          # Main layout with sidebar + header
│   │   ├── figma/              # Custom Figma-exported components
│   │   ├── ui/                 # shadcn/ui component library (~50 components)
│   │   └── [feature]/          # Feature-specific components (course, reader, quiz, etc.)
│   └── pages/                  # 41+ route page components
├── stores/                     # ~40+ Zustand stores (auth, courses, books, progress, etc.)
├── db/                         # Dexie schema (50+ IndexedDB tables)
├── ai/                         # AI subsystem (embeddings, RAG, quiz gen, tutors, web workers)
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
├── solutions/                  # Documented solutions (bugs, best practices, workflow patterns); YAML frontmatter: module, tags, problem_type — search before debugging or implementing in documented areas
├── research/                   # Technical research

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
- Feature-specific components in `src/app/components/[feature]/`
- Zustand stores in [src/stores/](src/stores/) — one store per domain
- Dexie database schema in [src/db/schema.ts](src/db/schema.ts) — 50+ tables
- All styling uses Tailwind utility classes with design tokens (never hardcoded colors)
- Icons from lucide-react
- Forms use react-hook-form with zod validation
- Images primarily from Unsplash (see ATTRIBUTIONS.md)

### Critical Pitfalls

- **Design tokens**: Never use hardcoded Tailwind colors (`bg-blue-600`). Use design tokens (`bg-brand`). See [styling.md](.claude/rules/styling.md).
- **Time in tests**: Never use `Date.now()` or `new Date()` in tests — use `FIXED_DATE`. See [testing/test-patterns.md](.claude/rules/testing/test-patterns.md).
- **Silent catches**: Catch blocks must include `toast.error()` or visible user feedback. See [automation.md](.claude/rules/automation.md).
- **IndexedDB cleanup**: Always `await` IDB cleanup in `afterEach` — fire-and-forget causes flaky pollution.
- **Worktree E2E**: Kill dev server on port 5173 before running E2E in a worktree.
- **TypeScript**: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. `src/premium/` is excluded from tsconfig.

## Project Rules

Detailed instructions are organized in `.claude/rules/` with smart path-specific loading:

### Universal Rules (Always Loaded)

- **[styling.md](.claude/rules/styling.md)** — Design tokens, Tailwind CSS v4, UI component library
- **[automation.md](.claude/rules/automation.md)** — ESLint rules, git hooks, review agents (12 mechanisms)
- **[workflows/story-workflow.md](.claude/rules/workflows/story-workflow.md)** — `/start-story`, `/review-story`, `/finish-story` commands
- **[ce-orchestrator](.claude/skills/ce-orchestrator/SKILL.md)** — `/ce-orchestrator "<idea|story-path|plan-path>"` — full CE pipeline (brainstorm → plan → work → review → PR) with single plan-approval gate; preferred for net-new features over writing a BMAD story first
- **[dexie-patterns](.claude/skills/dexie-patterns/SKILL.md)** — Dexie/IndexedDB conventions — schema, CRUD, transactions, sync integration, migrations
- **[zustand-store](.claude/skills/zustand-store/SKILL.md)** — Zustand store conventions — boilerplate, state shape, actions, selectors, persistence
- **[component-scaffold](.claude/agents/component-scaffold.md)** — Agent that scaffolds a complete new feature (page, components, store, route, types, schema)

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
- **Skills Index**: [.claude/skills/](.claude/skills/)
- **Agents Index**: [.claude/agents/](.claude/agents/)

## Maintaining CLAUDE.md

When I make a mistake due to missing context:
1. Fix the immediate issue
2. Suggest adding the correction to CLAUDE.md or `.claude/rules/*.md` (whichever is appropriate)
3. Keep entries concise (prefer file:line references over code examples)

**Length Guidelines**:
- Root CLAUDE.md: Keep < 300 lines (currently ~250)
- `.claude/rules/*.md`: No limit, but prefer splitting large files
- Use path-specific frontmatter in rules to control when they load

## Session Compacting

When compacting conversations, produce a short handoff with these sections:

1. **Goal** — What we're working toward
2. **Current plan** — Implementation approach
3. **Files changed** — What was modified and why
4. **Commands run and results** — What succeeded or failed
5. **Open issues / blockers** — Bugs or obstacles
6. **TODOs** — Remaining tasks
7. **Next step** — Immediate action

**Exclude:**
- Chatter and conversational filler
- Repeated exploration cycles
- Abandoned ideas that no longer matter
- Large logs or command output (unless still relevant)

## References

**Official Documentation:**
- [Claude Code Memory](https://docs.anthropic.com/en/docs/claude-code/memory)
- [Path-Specific Rules](https://paddo.dev/blog/claude-rules-path-specific-native/)

**Project Documentation:**
- [Story Template](docs/implementation-artifacts/story-template.md)
- [Sprint Status](docs/implementation-artifacts/sprint-status.yaml)
- [Design Principles](.claude/workflows/design-review/design-principles.md)
