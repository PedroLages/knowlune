# Implementation Plan: E64-S09 — Service Worker Precache Optimization

## 1. Context

The current `injectManifest` config uses a broad glob pattern (`**/*.{js,css,html,svg,png,webp,woff2}`) that precaches all 343 entries / ~21.6 MB. This includes large optional chunks (tiptap, chart, pdf, AI SDKs) and all lazy route chunks — wasting bandwidth on metered/slow connections and slowing initial PWA install.

**Goal**: Reduce precache to <3 MB by precaching only the critical app shell. Route-specific chunks are cached at runtime via `StaleWhileRevalidate` on first visit.

**Current baseline** (from build): 343 precache entries / 21.6 MB.

## 2. Prerequisite: Build Chunk Inventory

Run `npm run build` and inspect `dist/assets/` to validate exact chunk naming patterns before writing globIgnores. This ensures patterns match actual Vite output.

Key chunks to identify:
- **Critical** (keep in precache): `react-vendor`, `radix-ui`, `react-router`, `dexie`, `style-utils`, `sonner`, `motion-vendor`, entry JS, CSS
- **Optional** (exclude from precache): `tiptap`, `prosemirror`, `syntax-highlight`, `chart`, `pdf`, `minisearch`, `date-fns`, `cmdk`, `ai-sdk-core`, `ai-openai`, `ai-anthropic`, `ai-groq`, `ai-google`, `ai-zhipu`, `react-youtube`, `sql-js`, `dnd-kit`, route-specific chunks, `splash/`, `sounds/`

## 3. Implementation Steps

### Step 1: Update `globIgnores` in `vite.config.ts`

**File**: `vite.config.ts` (lines 549-550)

Replace the current `globIgnores: ['**/mockServiceWorker.js', '**/webllm*.js']` with expanded exclusions for all optional chunks identified in the prerequisite step.

**What stays precached** (critical app shell):
- `index.html`, entry JS, CSS
- `react-vendor`, `radix-ui`, `react-router`, `dexie`, `style-utils`, `sonner`, `motion-vendor` (all eagerly loaded at app startup)
- All SVG/PNG icons and favicons
- `offline.html`, `reduce-motion-init.js`

**Scope**: ~20 lines changed in a single file.

### Step 2: Add Route-Chunk Runtime Caching in `src/sw.ts`

**File**: `src/sw.ts` (between ABS proxy rule and navigation fallback, around line 72)

Add a `registerRoute` with `StaleWhileRevalidate` strategy matching `/^\/assets\/.+\.js$/i`:
- `cacheName: 'route-chunks'`
- `ExpirationPlugin`: `maxEntries: 50`, `maxAgeSeconds: 30 * 24 * 60 * 60` (30 days)

**Why `/^\/assets\/.+\.js$/i` works**: `precacheAndRoute` is registered first — precached files are served before this rule is reached. Non-precached JS files (route chunks, optional libs) fall through and are cached on first access. Simple regex avoids needing per-route patterns.

**Placement**: After existing 5 runtime rules (images, Unsplash, HF, AI API, ABS proxy) and before the navigation fallback. More specific rules must be registered first.

**Scope**: ~10 lines added.

### Step 3: Create `OfflineRouteFallback` Component

**File**: New `src/app/components/OfflineRouteFallback.tsx`

Follows the `EmptyState` component pattern: Card (`border-2 border-dashed`) + WifiOff icon in `rounded-full bg-brand-soft` + heading + description + "Go Home" button (`variant="brand"`, links to `/courses`).

Uses design tokens: `bg-card`, `text-muted-foreground`, `bg-brand-soft`, `text-brand-soft-foreground`.

**Scope**: ~35 lines, one new file.

### Step 4: Create `ChunkErrorBoundary` Component

**File**: New `src/app/components/ChunkErrorBoundary.tsx`

Class component that detects chunk load failures by checking error patterns:
- `TypeError` + `Failed to fetch` / `dynamically imported` / `Loading chunk` / `ChunkLoadError`

Behavior:
- **Chunk load errors**: Shows `OfflineRouteFallback`
- **Other errors**: Delegates to existing `RouteErrorFallback` (with retry)

**Scope**: ~70 lines, one new file.

### Step 5: Update `SuspensePage` in `routes.tsx`

**File**: `src/app/routes.tsx` (lines 200-206)

Wrap `Suspense` children with `ChunkErrorBoundary`:
```tsx
<RouteErrorBoundary>
  <ChunkErrorBoundary>
    <Suspense fallback={<PageLoader />}>{children}</Suspense>
  </ChunkErrorBoundary>
</RouteErrorBoundary>
```

**Error flow**: Lazy import fails → `ChunkErrorBoundary` catches → shows `OfflineRouteFallback` (if chunk error) or `RouteErrorFallback` (if component error). Parent `RouteErrorBoundary` is safety net.

**Scope**: 2 lines added (import) + 2 lines changed.

### Step 6: Verify Build and Precache Size

Run `npm run build` and verify:
1. Build succeeds
2. Precached entries < 50 (down from 343)
3. Total precache size < 3 MB
4. Critical chunks present in manifest
5. Optional chunks NOT in manifest
6. Route-chunk runtime rule present in compiled `dist/sw.js`

### Step 7: Manual Offline Testing

Use `npm run preview` + DevTools offline simulation to verify all 4 acceptance criteria.

## 4. Verification

### Automated
```bash
npm run build                          # Must succeed
npm run ci                             # All existing tests must pass
```

### Manual Test Matrix
| Test | Expected Result |
|------|----------------|
| Online: visit `/courses` | Chunk cached in 'route-chunks' |
| Offline: revisit `/courses` | Loads from runtime cache |
| Offline: navigate to unvisited route | "This page isn't available offline" |
| Online: navigate to previously-offline route | Loads normally (not stuck on fallback) |
| PWAUpdatePrompt | Still triggers on SW update |
| PWAInstallBanner | Still fires when conditions met |
| Images offline | Still load from CacheFirst/StaleWhileRevalidate |

## 5. Risk Assessment

### Risk 1: Overly Aggressive Exclusions (HIGH)
If a chunk is excluded from precache but eagerly loaded by the entry bundle, the app shell fails offline.

**Mitigation**: The route-chunk rule `/^\/assets\/.+\.js$/i` catches ALL non-precached JS files. Eagerly-loaded chunks excluded from precache are cached at runtime on first online visit. `sonner`, `style-utils`, and `motion-vendor` are kept in precache since they're loaded at startup.

### Risk 2: Chunk Load Error Detection (MEDIUM)
Error message patterns vary between browsers and Vite versions.

**Mitigation**: Multiple pattern checks (error name + message). False positive → shows friendly offline message. False negative → falls through to `RouteErrorBoundary` (existing generic error UI — acceptable).

### Risk 3: Route Chunk Pattern Mismatch (LOW)
If chunks use unexpected naming (e.g., nested subdirectories), the runtime regex might not match.

**Mitigation**: The regex `.+` matches any character including `/`. Build inspection validates naming before implementation.

## 6. Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `vite.config.ts` | Modify | Update `globIgnores` |
| `src/sw.ts` | Modify | Add route-chunk `registerRoute` |
| `src/app/components/OfflineRouteFallback.tsx` | **Create** | Offline fallback UI |
| `src/app/components/ChunkErrorBoundary.tsx` | **Create** | Chunk load error boundary |
| `src/app/routes.tsx` | Modify | Wrap lazy routes with `ChunkErrorBoundary` |

**No changes**: `RouteErrorBoundary`, `Layout`, `PWAUpdatePrompt`, `PWAInstallBanner`, `useOnlineStatus`, `public/offline.html`.
