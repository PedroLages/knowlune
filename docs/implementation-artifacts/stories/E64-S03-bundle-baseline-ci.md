# Story 64.3: Bundle size baseline and regression detection

Status: ready-for-dev

## Story

As a developer adding features to Knowlune,
I want automatic bundle size regression detection,
so that performance degradation is caught before code is merged.

## Acceptance Criteria

1. **Given** the file `docs/reviews/performance/bundle-baseline.json` exists with current metrics
   **When** I run `node scripts/bundle-check.js` after `npm run build`
   **Then** the script outputs a comparison showing initial load gzipped size, total bundle size, and chunk count vs baseline
   **And** exits with code 0 if initial load is within 10% of baseline

2. **Given** a build where initial load exceeds baseline by more than 10%
   **When** I run `node scripts/bundle-check.js`
   **Then** the script exits with code 1
   **And** outputs which chunks grew and by how much (human-readable diff)

3. **Given** the `/review-story` pre-checks workflow
   **When** pre-checks run during a story review
   **Then** the bundle baseline comparison is included in the pre-check output
   **And** a >10% regression triggers a warning (not a hard block, but flagged prominently)

## Tasks / Subtasks

- [ ] Task 1: Create bundle baseline JSON file (AC: 1)
  - [ ] 1.1 Run `npm run build` and capture current metrics
  - [ ] 1.2 Create `docs/reviews/performance/bundle-baseline.json` with structure: `{ generatedAt, viteVersion, initialLoad: { jsGzipped, cssGzipped, totalGzipped, modulePreloadCount }, totalBundle: { jsRaw, jsGzipped, chunkCount }, topChunks: [...] }`
  - [ ] 1.3 Note: Best created AFTER E64-S01 and E64-S02 to capture optimized state
- [ ] Task 2: Create bundle comparison script (AC: 1, 2)
  - [ ] 2.1 Create `scripts/bundle-check.js` (Node.js, no external deps)
  - [ ] 2.2 Parse `dist/index.html` for modulepreload tags
  - [ ] 2.3 Read `dist/assets/` file sizes and compute gzipped sizes (use `zlib.gzipSync`)
  - [ ] 2.4 Compare against baseline JSON
  - [ ] 2.5 Output human-readable diff table showing chunk name, baseline size, current size, delta
  - [ ] 2.6 Exit code 0 if within 10% threshold, exit code 1 if exceeded
- [ ] Task 3: Integrate with `/review-story` pre-checks (AC: 3)
  - [ ] 3.1 Add bundle check step to `scripts/workflow/run-prechecks.sh`
  - [ ] 3.2 Run `npm run build && node scripts/bundle-check.js` as a pre-check
  - [ ] 3.3 Flag regression as WARNING (not blocker) in pre-check output
- [ ] Task 4: Add baseline update command (AC: 1)
  - [ ] 4.1 Add `--update` flag to `scripts/bundle-check.js` that writes current metrics as new baseline
  - [ ] 4.2 Document usage: `node scripts/bundle-check.js --update` after intentional size changes

## Dev Notes

### Architecture Decision: AD-9

Store a committed JSON baseline of chunk sizes. The `/review-story` pre-check and optional script compare against it. [Source: architecture-performance-optimization.md#AD-9]

### Implementation Details

**Baseline JSON structure:**
```json
{
  "generatedAt": "2026-03-29T00:00:00Z",
  "viteVersion": "6.4.1",
  "initialLoad": {
    "jsGzipped": 433000,
    "cssGzipped": 36000,
    "totalGzipped": 469000,
    "modulePreloadCount": 8
  },
  "totalBundle": {
    "jsRaw": 7002000,
    "jsGzipped": 2025000,
    "chunkCount": 168
  },
  "topChunks": [
    { "name": "index", "gzipped": 184000 }
  ]
}
```

**Script requirements:**
- Node.js only — no external dependencies (use `fs`, `path`, `zlib` built-ins)
- Parse `dist/index.html` to find `<link rel="modulepreload">` tags
- Compute gzipped sizes using `zlib.gzipSync(fs.readFileSync(file))`
- 10% threshold on `initialLoad.totalGzipped`

### Key Constraints

- Script must work without installing extra dependencies (`node scripts/bundle-check.js`)
- Baseline file is committed to git — changes tracked in version history
- Pre-check integration is a WARNING, not a hard blocker (prevents blocking legitimate feature additions)
- This story is best implemented AFTER E64-S01 and E64-S02 to capture the optimized baseline

### Project Structure Notes

- **New files**: `scripts/bundle-check.js`, `docs/reviews/performance/bundle-baseline.json`
- **Modified**: `scripts/workflow/run-prechecks.sh` (add bundle check step)
- Existing pre-checks script is at `scripts/workflow/run-prechecks.sh`
- The `docs/reviews/performance/` directory may need to be created

### References

- [Source: _bmad-output/planning-artifacts/architecture-performance-optimization.md#AD-9]
- [Source: _bmad-output/planning-artifacts/prd-performance-optimization.md#FR-4]
- [Source: _bmad-output/planning-artifacts/epics-performance-optimization.md#Story-64.3]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
