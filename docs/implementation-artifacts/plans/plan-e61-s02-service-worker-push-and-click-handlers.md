---
story_id: E61-S02
reviewed: in-progress
review_started: 2026-07-05
review_gates_passed: []
---
# E61-S02 Implementation Plan: Service Worker Push and Click Handlers

## 1. Context

### 1.1 Problem

The current service worker (`src/sw.ts`, 140 lines) contains a minimal push placeholder from E61-S01 that only handles `title` and `body` fields. It lacks:

- **notificationclick** handler — clicking a notification does nothing
- **pushsubscriptionchange** handler — if the browser renews the push subscription, the backend is never notified
- **icon, badge, tag, and url** support in push — notifications lack branding, deduplication, and deep linking

This means study-reminder push notifications, even if delivered, cannot navigate users to the relevant page and cannot be deduplicated.

### 1.2 What This Story Delivers

Three complete service worker event handlers in a single file (`src/sw.ts`):

| Handler | Purpose |
|---------|---------|
| `push` (replaces placeholder) | Show notification with full payload: title, body, icon, badge, tag, url |
| `notificationclick` (new) | Close notification → focus existing tab or open new tab at payload URL |
| `pushsubscriptionchange` (new) | Re-subscribe with same VAPID key → POST new subscription to backend |

Plus two static icon assets in `public/icons/`.

### 1.3 Constraints

- **Single file**: All changes in `src/sw.ts` only
- **No new npm dependencies**
- **No React/UI components** — pure service worker code
- **No DOM/Zustand imports** — only Workbox + `ServiceWorkerGlobalScope`
- **Must preserve** existing Workbox precaching, runtime caching rules, navigation fallback, and lifecycle handlers intact
- **Downstream compatibility**: S03 needs `pushsubscriptionchange` POST format, S05 needs push payload parsing, S07 needs notificationclick deep linking

### 1.4 Files Involved

| File | Action | Scope |
|------|--------|-------|
| `src/sw.ts` | Modify — replace push placeholder, add two new handlers | ~70 new lines |
| `public/icons/icon-192.png` | Create — copy of `public/pwa-192x192.png` | 1 file |
| `public/icons/badge-72.png` | Create — new monochrome 72×72 asset | 1 file |
| `tests/e2e/story-e61-s02.spec.ts` | Exists — validates build output (no changes needed) | Already written |

---

## 2. Implementation Steps

### Step 1: Create notification icon assets

**Why first**: The push handler references these paths. Build must include them.

**1a. Create `public/icons/` directory**

```bash
mkdir -p public/icons
```

**1b. Create `public/icons/icon-192.png`**

Copy the existing PWA icon:

```bash
cp public/pwa-192x192.png public/icons/icon-192.png
```

**1c. Create `public/icons/badge-72.png`**

This needs to be a **monochrome 72×72 PNG with transparent background**. Android strips color from badge icons displayed in the status bar — a monochrome design ensures consistent appearance.

Options:
- Create manually in an image editor (Figma, Sketch, GIMP)
- Generate programmatically via a script (e.g., resize + desaturate the 192px icon to 72px)
- The badge should be a simplified, single-color version of the Knowlune icon (dark-on-transparent)

**Vite PWA integration**: The existing `globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}']` in `vite.config.ts` already includes PNG files, so `public/icons/*.png` will be picked up by the build automatically. No config changes needed.

**Scope**: ~5 minutes for copy + manual image creation.

---

### Step 2: Replace push event placeholder with full handler

**File**: `src/sw.ts`, replace lines ~105–140 (the existing push event listener block)

**What to change**:

Replace the entire `// ─── Push event placeholder ───` section and its `self.addEventListener('push', ...)` block with the full implementation.

**Key additions over the placeholder**:

| Field | Placeholder (E61-S01) | Full Handler (E61-S02) |
|-------|----------------------|------------------------|
| `icon` | Hardcoded `/pwa-192x192.png` | `/icons/icon-192.png` (via defaults object) |
| `badge` | Not set | `/icons/badge-72.png` (browser-dependent) |
| `tag` | Not parsed | Parsed from payload → passed through to `showNotification` for deduplication |
| `url` | Not parsed | Parsed from payload → stored in `data.url` for notificationclick handler |
| Fallback | Separate try/catch with manual string checks | Single try/catch — spreads payload over defaults, catches invalid JSON cleanly |

**Implementation pattern**:

```ts
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const defaults = {
        title: 'Knowlune',
        body: 'You have a new notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
      };

      let notificationOptions: NotificationOptions & { data?: { url?: string } } = { ...defaults };

      try {
        if (event.data) {
          const payload = event.data.json();
          notificationOptions = {
            ...defaults,
            ...payload,
            data: { url: payload.url || '/' },
          };
        }
      } catch {
        // Invalid/missing payload — use defaults (already set above)
      }

      await self.registration.showNotification(
        notificationOptions.title || defaults.title,
        notificationOptions
      );
    })()
  );
});
```

**Critical details**:
- `event.waitUntil()` wraps an async IIFE — mandatory; without it the browser may terminate the SW before `showNotification` completes
- Every push MUST call `showNotification` — browser requirement; failure can revoke push permission
- `...defaults, ...payload` ensures payload fields override defaults while missing fields fall back
- `data: { url: payload.url || '/' }` stores the deep-link URL for the notificationclick handler
- The `tag` field passes through directly — the browser handles deduplication (same tag = replace existing notification)
- The catch block is intentionally empty — `defaults` already assigned; this is the "generic fallback" from AC 3

**Scope**: ~25 lines replaced. This is the largest single change.

---

### Step 3: Add notificationclick handler

**File**: `src/sw.ts`, append after the push handler

**What to add**: A new `self.addEventListener('notificationclick', ...)` block.

**Implementation**:

```ts
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Try to focus an existing Knowlune tab
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          // Navigate if URL differs from current
          if (clientUrl.pathname !== url) {
            if ('navigate' in client) {
              await (client as WindowClient).navigate(url);
            }
            // Fallback: postMessage for non-Chromium browsers
            client.postMessage({ type: 'NAVIGATE', url });
          }
          await client.focus();
          return;
        }
      }

      // No existing tab — open new one (allowed on user gesture)
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })()
  );
});
```

**Key behaviors**:
1. **Close notification**: `event.notification.close()` — always first
2. **Find existing tab**: `clients.matchAll({ type: 'window', includeUncontrolled: true })` — matches same-origin tabs
3. **Focus + navigate**: If tab found at same origin → `client.focus()`. If URL differs → `client.navigate()` (Chromium) or `postMessage` fallback
4. **Open new tab**: If no tab found → `clients.openWindow(url)` — only works because notificationclick is a user gesture
5. **`client.navigate()` is Chromium-only**: The `postMessage({ type: 'NAVIGATE', url })` fallback lets the app page's message listener handle React Router navigation for Firefox/Safari

**Downstream compatibility (E61-S07)**: The `NAVIGATE` postMessage format is the contract that E61-S07 will consume in the app's message listener.

**Scope**: ~25 new lines, appended after push handler.

---

### Step 4: Add pushsubscriptionchange handler

**File**: `src/sw.ts`, append after notificationclick handler

**What to add**: A new `self.addEventListener('pushsubscriptionchange', ...)` block.

**Implementation**:

```ts
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const newSubscription = await self.registration.pushManager.subscribe(
          event.oldSubscription.options
        );

        // Send new subscription to backend
        await fetch('/api/push/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSubscription.toJSON()),
        });
      } catch (error) {
        // Log but don't throw — subscription loss is recoverable
        // on next app visit via usePushSubscription hook
        console.error('[SW] Push subscription change failed:', error);
      }
    })()
  );
});
```

**Key behaviors**:
1. **Re-subscribe**: `pushManager.subscribe(event.oldSubscription.options)` — reuses the same `applicationServerKey` (VAPID key) from the original subscription
2. **POST to backend**: Sends the new subscription JSON to `/api/push/subscriptions`
3. **Fail gracefully**: Catch block logs but doesn't throw — if the backend endpoint doesn't exist yet, the subscription loss is recoverable on next app visit via `usePushSubscription` hook
4. **`event.waitUntil()`**: Mandatory for async SW operations

**Downstream compatibility (E61-S03)**: The POST format (`newSubscription.toJSON()`) and endpoint path (`/api/push/subscriptions`) are the contract E61-S03 will build the backend against.

**Scope**: ~15 new lines, appended after notificationclick handler.

---

### Step 5: Verify file structure

**After all changes, `src/sw.ts` should have this structure** (top to bottom):

```
1.  File header comment (keep existing)
2.  declare let self: ServiceWorkerGlobalScope (keep)
3.  Workbox imports (keep)
4.  ─── Precache ─── (keep)
5.  ─── Runtime caching rules ─── (keep — 5 rules)
6.  ─── Navigation fallback ─── (keep)
7.  ─── Default handler ─── (keep)
8.  ─── SW Lifecycle ─── (keep — activate + clients.claim)
9.  ─── SKIP_WAITING message listener ─── (keep)
10. ─── Push event handler ─── (REPLACED — full implementation)
11. ─── Notification click handler ─── (NEW)
12. ─── Push subscription change handler ─── (NEW)
```

Total file: ~180 lines (up from ~140).

---

## 3. Verification

### 3.1 Build Verification

```bash
# Build the project
npm run build

# Verify sw.js contains all 3 handlers
grep -c "addEventListener.*push" dist/sw.js          # > 0
grep -c "addEventListener.*notificationclick" dist/sw.js  # > 0
grep -c "addEventListener.*pushsubscriptionchange" dist/sw.js  # > 0

# Verify handlers call waitUntil (mandatory)
grep -c "waitUntil" dist/sw.js  # should be >= 4 (activate + push + notificationclick + pushsubscriptionchange)

# Verify showNotification is called
grep -c "showNotification" dist/sw.js  # > 0

# Verify icon assets
ls -la dist/icons/icon-192.png   # must exist
ls -la dist/icons/badge-72.png   # must exist

# Run E2E build verification tests
npx playwright test tests/e2e/story-e61-s02.spec.ts
```

### 3.2 Full CI

```bash
npm run ci
```

Must pass: typecheck → lint → format:check → build → test:unit. No regressions.

### 3.3 Manual Testing (Chrome DevTools)

**Prerequisites**: Push permission granted in the browser.

**Test 1 — Full payload notification**:
1. Open DevTools → Application → Service Workers → Find Knowlune SW → "Push"
2. Enter: `{"title":"Study Reminder","body":"Time to review!","icon":"/icons/icon-192.png","badge":"/icons/badge-72.png","tag":"review-due","url":"/flashcards"}`
3. Expected: Notification with correct title, body, icon, badge. Click → navigates to `/flashcards`

**Test 2 — No payload / fallback**:
1. Push with empty input
2. Expected: Generic "Knowlune" / "You have a new notification"
3. Expected: Click → opens `/` (default URL)

**Test 3 — Tag deduplication**:
1. Push with `"tag": "review-due"` twice
2. Expected: Only one notification visible (second replaces first)

**Test 4 — App-open click behavior**:
1. Have Knowlune open at `/library`
2. Push with `"url": "/flashcards"` → click notification
3. Expected: Existing tab focuses AND navigates to `/flashcards`

**Test 5 — App-closed click behavior**:
1. Close all Knowlune tabs
2. Push with `"url": "/notes"` → click notification
3. Expected: New tab opens at `/notes`

### 3.4 E2E Test Expectations

The existing `tests/e2e/story-e61-s02.spec.ts` validates:
- `dist/sw.js` contains all required handlers and calls
- `dist/icons/icon-192.png` and `dist/icons/badge-72.png` exist
- SW registration succeeds in the browser
- `PushManager` is available after registration

All of these should pass after implementation.
