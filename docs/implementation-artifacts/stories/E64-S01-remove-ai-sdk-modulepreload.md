# Story 64.1: Remove AI SDK modulepreload and verify lazy loading boundaries

Status: ready-for-dev

## Story

As a Knowlune user,
I want the app to load faster on initial page visit,
so that I can start using the platform without waiting for AI libraries I may not need.

## Acceptance Criteria

1. **Given** a production build is generated with `npm run build`
   **When** I inspect `dist/index.html`
   **Then** no `<link rel="modulepreload">` tags reference `ai-anthropic`, `ai-sdk-core`, `ai-openai`, `ai-google`, `ai-groq`, or `ai-zhipu` chunks
   **And** the initial load (all modulepreload JS + CSS, gzipped) is at least 100 KB less than the pre-optimization baseline of 540 KB

2. **Given** I navigate to the Notes Q&A page and trigger an AI query
   **When** the AI provider is invoked
   **Then** the AI SDK chunks download on-demand via dynamic import
   **And** the AI feature functions correctly (response received)

3. **Given** a production build is generated
   **When** I compare the `dist/index.html` modulepreload count
   **Then** it contains fewer than 10 modulepreload hints (down from 12)

## Tasks / Subtasks

- [ ] Task 1: Add `build.modulePreload.resolveDependencies` to vite.config.ts (AC: 1, 3)
  - [ ] 1.1 Add `resolveDependencies` callback that filters out AI SDK chunk patterns
  - [ ] 1.2 Exclude patterns: `ai-anthropic`, `ai-sdk-core`, `ai-openai`, `ai-google`, `ai-groq`, `ai-zhipu`
  - [ ] 1.3 Run `npm run build` and verify `dist/index.html` has no AI SDK modulepreload links
  - [ ] 1.4 Verify modulepreload count < 10
- [ ] Task 2: Verify AI features still work with dynamic imports (AC: 2)
  - [ ] 2.1 Confirm AI SDK chunks still exist in `dist/assets/` (they are built, just not preloaded)
  - [ ] 2.2 Manual smoke test: trigger AI query on Notes Q&A and confirm response
- [ ] Task 3: Measure and document initial load reduction (AC: 1)
  - [ ] 3.1 Record pre-optimization initial load size (baseline)
  - [ ] 3.2 Record post-optimization initial load size
  - [ ] 3.3 Verify >= 100 KB gzipped reduction
- [ ] Task 4: Ensure all existing E2E tests pass (AC: all)
  - [ ] 4.1 Run full E2E suite to confirm no regressions

## Dev Notes

### Architecture Decision: AD-1

Use Vite 6's `build.modulePreload.resolveDependencies` to exclude AI SDK chunks from initial preload. This is a Vite-native config-only solution with zero source code changes. [Source: architecture-performance-optimization.md#AD-1]

### Implementation Pattern

```typescript
// vite.config.ts — inside the build config object
build: {
  modulePreload: {
    resolveDependencies: (filename, deps, { hostId, hostType }) => {
      const excludePatterns = ['ai-anthropic', 'ai-sdk-core', 'ai-openai',
                               'ai-google', 'ai-groq', 'ai-zhipu']
      return deps.filter(dep =>
        !excludePatterns.some(pattern => dep.includes(pattern))
      )
    }
  },
  // ... existing rollupOptions
}
```

### Key Constraints

- **Do NOT modify any source code** — this is purely a Vite build config change
- **Do NOT remove AI SDK from the bundle** — only remove from modulepreload hints
- The existing `rollupOptions.output.manualChunks` config must be preserved (20+ chunk splitting rules already exist)
- `vite.config.ts` is a large file (~500 lines) with Ollama proxy plugin, premium guard plugin, YouTube transcript proxy, PWA config, and manual chunks — add the `modulePreload` config inside the existing `build:` block

### Project Structure Notes

- **Target file**: `vite.config.ts` (root)
- The `build` config block already exists with `rollupOptions` — nest `modulePreload` alongside it
- AI SDKs are already dynamically imported in source code, but Vite's static analysis includes them in preload hints through transitive references

### Expected Impact

- Initial load drops from ~540 KB to ~433 KB gzipped (-20%, saving ~107 KB)
- No functional changes — AI features load on-demand as before

### References

- [Source: _bmad-output/planning-artifacts/architecture-performance-optimization.md#AD-1]
- [Source: _bmad-output/planning-artifacts/prd-performance-optimization.md#FR-1]
- [Source: _bmad-output/planning-artifacts/epics-performance-optimization.md#Story-64.1]
- Vite docs: https://vite.dev/config/build-options#build-modulepreload

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
