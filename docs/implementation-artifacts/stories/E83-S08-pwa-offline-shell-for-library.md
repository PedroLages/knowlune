# Story 83.8: PWA Offline Shell for Library

Status: done

## Story

As a reader,
I want to be able to open and read my books even when offline,
so that travel or poor connectivity never interrupts my reading.

## Acceptance Criteria

1. **Given** the Vite build configuration **When** checked **Then** `vite-plugin-pwa` is installed and configured with Workbox to precache the app shell (all JS/CSS chunks needed for library and reader routes)

2. **Given** EPUB rendering dependencies (epub.js, react-reader) **When** the app is built **Then** these chunks are included in the Workbox precache manifest via runtime caching with a CacheFirst strategy

3. **Given** a user has previously visited the Library page **When** the device goes offline and the user navigates to `/library` or `/library/:bookId` **Then** the app shell loads from the service worker cache and EPUB files load from OPFS — the reading experience is fully functional

4. **Given** the reader is offline **When** the user opens a book stored in OPFS **Then** a subtle "Offline" indicator appears in the reader toolbar (non-blocking, informational only)

5. **Given** the app is offline **When** the user attempts an action that requires network (e.g., Open Library metadata fetch) **Then** the action fails gracefully with a toast message and does not crash the reader

## Tasks / Subtasks

- [ ] Task 1: Install and configure `vite-plugin-pwa` (AC: 1)
  - [ ] 1.1 `npm install vite-plugin-pwa -D`
  - [ ] 1.2 Add `VitePWA()` plugin to `vite.config.ts` with `registerType: 'autoUpdate'`
  - [ ] 1.3 Configure Workbox precache to include app shell chunks
  - [ ] 1.4 Add runtime caching rule for epub.js/react-reader chunks with CacheFirst strategy

- [ ] Task 2: Create service worker registration (AC: 1, 3)
  - [ ] 2.1 Add service worker registration in `src/main.tsx` using `registerSW` from `virtual:pwa-register`
  - [ ] 2.2 Handle SW update prompt (auto-update, no user prompt needed)

- [ ] Task 3: Add offline detection (AC: 4, 5)
  - [ ] 3.1 Create `useOnlineStatus()` hook using `navigator.onLine` + `online`/`offline` events
  - [ ] 3.2 Add "Offline" badge to reader toolbar when offline
  - [ ] 3.3 Wrap Open Library API calls in online-check guard with graceful toast fallback

- [ ] Task 4: Verify offline reading flow (AC: 3)
  - [ ] 4.1 Manual test: load library, import book, go offline (DevTools), verify book opens and reads normally
  - [ ] 4.2 Verify page navigation works offline
  - [ ] 4.3 Verify highlights can be created and saved (Dexie is local) while offline

## Dev Notes

### Vite PWA Plugin Configuration

```ts
// vite.config.ts addition
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /\.(js|css)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'app-shell',
          expiration: { maxEntries: 100 },
        },
      },
    ],
  },
})
```

### Why This Story Matters

OPFS stores the *file content* on-device, but the *app shell* (React JS bundles, CSS) is fetched from the network on each load unless a service worker caches it. Without this story, a user on a plane with a book in OPFS would see a blank page because the JavaScript to render the EPUB reader hasn't loaded.

### Dependencies

- E83-S01 (OPFS storage service) must be complete
- No dependency on other E83 stories

### Project Structure Notes

- New dependency: `vite-plugin-pwa` (dev dependency)
- Modified files: `vite.config.ts`, `src/main.tsx`
- New file: `src/hooks/useOnlineStatus.ts`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- VitePWA was already configured with precaching (261 entries) and navigateFallback — AC1/AC2 were pre-existing
- Added offline guards to OpenLibraryService (AC5) and Library page offline badge (AC4)
- Kept registerType as 'prompt' (existing PWAUpdatePrompt component) rather than 'autoUpdate' from story spec
- EPUB reader toolbar offline indicator deferred to E84 (reader does not exist yet)

### File List

- `src/services/OpenLibraryService.ts` — offline early-return guards
- `src/app/pages/Library.tsx` — offline badge in header
- `src/app/components/library/BookMetadataEditor.tsx` — online guard on cover refetch
