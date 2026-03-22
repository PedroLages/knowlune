# LevelUp - Development Guide

> Generated: 2026-02-15 | Scan Level: Quick

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18+ | Required for Vite and toolchain |
| npm | 9+ | Package manager |
| Git | 2+ | Version control |
| Docker | 20+ | Optional - for containerized development |

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd Elearningplatformwireframes

# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:5173
```

## Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000/api` | Mock API backend URL |
| `NODE_ENV` | `development` | Environment mode |
| `VITE_HOST` | `0.0.0.0` | Vite server host binding |
| `VITE_PORT` | `5173` | Vite server port |
| `VITE_API_DEBUG` | `false` | Enable API request logging |
| `VITE_API_TIMEOUT` | `30000` | API request timeout (ms) |

## Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server (localhost:5173) |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build locally |
| `npm run storybook` | Start Storybook (localhost:6006) |
| `npm run build-storybook` | Build static Storybook site |

### Code Quality

| Command | Description |
|---------|-------------|
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking (tsc --noEmit) |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

### Testing

| Command | Description |
|---------|-------------|
| `npm test` | Run Vitest in watch mode |
| `npm run test:unit` | Run unit tests with coverage |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run Playwright E2E tests with UI |

### Performance

| Command | Description |
|---------|-------------|
| `npm run lighthouse` | Run Lighthouse CI audit |
| `npm run lighthouse:collect` | Collect Lighthouse metrics |
| `npm run lighthouse:assert` | Assert Lighthouse thresholds |
| `npm run lighthouse:docker` | Run Lighthouse via Docker |

### CI Pipeline

| Command | Description |
|---------|-------------|
| `npm run ci` | Full CI check (typecheck + lint + format + build + unit tests) |
| `npm run ci:docker` | Run CI in Docker container |

## Build Configuration

### Vite (`vite.config.ts`)

- **React Plugin**: `@vitejs/plugin-react`
- **Tailwind Plugin**: `@tailwindcss/vite` (v4)
- **Custom Media Plugin**: `serveLocalMedia()` - serves local course files from `/Volumes/SSD/GFX/Chase Hughes - The Operative Kit` during development at `/media/*`
- **Path Alias**: `@` resolves to `./src`
- **Asset Imports**: SVG and CSV files supported as raw imports

### TypeScript (`tsconfig.json`)

- **Target**: ES2020
- **Module**: ESNext with bundler resolution
- **Strict Mode**: Enabled
- **JSX**: react-jsx
- **Path Alias**: `@/*` maps to `./src/*`
- **Strict Checks**: noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch

### ESLint (`eslint.config.js`)

- **Config Style**: Flat config (ESLint 9+)
- **Parser**: typescript-eslint
- **Rules**: Recommended + Storybook plugin
- **Custom**: Unused vars warn (with `_` prefix ignored), no-explicit-any warn

### Prettier (`.prettierrc`)

Standard Prettier configuration for consistent formatting.

### shadcn/ui (`components.json`)

- **Style**: New York
- **RSC**: false (client-side React)
- **Component Aliases**: `@/app/components/ui`
- **Base Color**: Neutral

## Testing Strategy

### Unit Tests (Vitest)

- **Location**: `src/lib/__tests__/`, `src/db/__tests__/`, `src/stores/__tests__/`
- **Environment**: jsdom
- **Setup**: `src/test/setup.ts`
- **Coverage**: @vitest/coverage-v8
- **Mocking**: fake-indexeddb for Dexie tests

Current test files:
- `courseImport.test.ts` - Course import logic
- `courseImport.integration.test.ts` - Integration tests
- `fileSystem.test.ts` - File system access
- `journal.test.ts` - Study journal
- `progress.test.ts` - Progress tracking
- `settings.test.ts` - Settings persistence
- `studyLog.test.ts` - Study session logging
- `schema.test.ts` - Database schema
- `useCourseImportStore.test.ts` - Zustand store

### E2E Tests (Playwright)

- **Location**: `tests/`
- **Config**: `playwright.config.ts`
- **Test Files**: accessibility, design-review, overview-design-analysis, week4-progress-chart
- **Screenshots**: `tests/screenshots/` (visual regression baselines)

### Storybook Visual Tests

- **Location**: `src/stories/`, component `.stories.tsx` files
- **Config**: `.storybook/`
- **Integration**: Vitest addon for Storybook test execution
- **Browser**: Chromium via Playwright

### API Mocking

- **MSW** (Mock Service Worker) for request interception
- **Mockoon** (`mockoon-data.json`) for standalone mock API server
- **Service Worker**: `public/mockServiceWorker.js`

## Architecture Notes

### Data Flow

```
User Action → React Component → Zustand Store / Dexie DB → Re-render
```

### Local-First Pattern

- All user data stored client-side in IndexedDB via Dexie
- No backend server required for core functionality
- Mock API available for development and testing scenarios
- Course content served from local filesystem via custom Vite plugin

### Import Conventions

```typescript
// Use @ alias for all imports
import { Button } from '@/app/components/ui/button'
import { db } from '@/db'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
```

### Component Conventions

- Page components in `src/app/pages/`
- Reusable UI primitives in `src/app/components/ui/` (shadcn/ui)
- Custom domain components in `src/app/components/figma/`
- All styling via Tailwind utility classes
- Icons from lucide-react
