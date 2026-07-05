# AGENTS.md

This file provides guidance to AI coding agents (GitHub Copilot, Cursor, Windsurf, etc.) when working with code in this repository.

## Quick Start

```bash
npm i                 # Install dependencies
npm run dev           # Start dev server (http://localhost:5173)
npm run ci            # Full CI: typecheck + lint + format:check + build + test:unit
npm run test:e2e      # Playwright E2E tests
```

## Tech Stack

React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + React Router v7 + Zustand 5 + Dexie/IndexedDB + shadcn/ui (Radix primitives) + Supabase auth/sync

## Critical Conventions

### Design Tokens (MUST FOLLOW)
**Never use hardcoded Tailwind colors.** Use design tokens from `src/styles/theme.css`:

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| `bg-blue-600` | `bg-brand` |
| `text-gray-500` | `text-muted-foreground` |
| `text-red-500` | `text-destructive` |
| `text-green-600` | `text-success` |

An ESLint rule enforces this at save-time. See [`.claude/rules/styling.md`](.claude/rules/styling.md) for full details.

### Import Alias
`@/` resolves to `./src`:
```typescript
import { Button } from '@/app/components/ui/button'
import { useCourseStore } from '@/stores/useCourseStore'
```

### Testing
- **Time**: Never use `Date.now()` or `new Date()` in tests — use `FIXED_DATE`
- **IndexedDB**: Always `await` cleanup in `afterEach` — fire-and-forget causes flaky pollution
- **E2E fixtures**: Guest sessions use `sessionStorage._knowluneE2eBrowserInit` — clear in `beforeEach` when testing anonymous `Landing`
- Run tests: `npm run test:unit` (Vitest) or `npm run test:e2e` (Playwright, 6 browser configs)
- See [`.claude/rules/testing/test-patterns.md`](.claude/rules/testing/test-patterns.md) and [`.claude/rules/testing/test-cleanup.md`](.claude/rules/testing/test-cleanup.md)

### Error Handling
Catch blocks **must** include `toast.error()` or visible user feedback. The `error-handling/no-silent-catch` ESLint rule warns on violations.

### File Organization
```
src/
├── app/pages/           # Route-level page components (41+ pages)
├── app/components/ui/   # shadcn/ui components (~50)
├── app/components/[feature]/  # Feature-specific components
├── stores/              # Zustand stores (~40+, one per domain)
├── db/schema.ts         # Dexie schema (50+ IndexedDB tables)
├── ai/                  # AI subsystem
└── styles/theme.css     # Design tokens (CSS custom properties, OKLCH)
```

## Common Pitfalls

1. **Worktree E2E**: Kill dev server on port 5173 before running E2E in a git worktree (`lsof -ti:5173 | xargs kill`)
2. **TypeScript strictness**: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true` — `src/premium/` is excluded
3. **Port conflicts**: Dev on 5173, preview on 4173, auth server on 3001
4. **CSS imports**: Use `@/` alias for CSS imports; Tailwind v4 uses `@tailwindcss/vite` (no PostCSS config)

## For Claude Code Users

See [**CLAUDE.md**](CLAUDE.md) for Claude-specific workflows (`/start-story`, `/review-story`, `/finish-story`), session compacting format, and the BMAD agent/skill ecosystem.

## More Details

- **[`.claude/rules/`](.claude/rules/)** — All project rules (styling, automation, testing, design review)
- **[`.claude/skills/dexie-patterns/`](.claude/skills/dexie-patterns/SKILL.md)** — Dexie/IndexedDB conventions (schema, CRUD, transactions, sync, migrations)
- **[`.claude/skills/zustand-store/`](.claude/skills/zustand-store/SKILL.md)** — Zustand store conventions (boilerplate, state shape, actions, selectors, persistence)
- **[`.claude/agents/component-scaffold.md`](.claude/agents/component-scaffold.md)** — Agent that scaffolds a complete new feature
- **[`docs/engineering-patterns.md`](docs/engineering-patterns.md)** — Engineering patterns and best practices
- **[`docs/known-issues.yaml`](docs/known-issues.yaml)** — Tracked pre-existing issues
