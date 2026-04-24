---
title: ABS Sync QA Fix Patterns — Deadlock Guard, 429 Throttle, Auth Guard, Dexie Migrations, Tooltip Scope, Cover Fallback
date: 2026-04-24
module: abs-sync
component: sync-engine
tags: [abs, supabase, dexie, sync, throttle, auth, deadlock, tooltip, ui, react]
problem_type: best_practices
category: sync
track: knowledge
plan: docs/plans/2026-04-24-002-fix-abs-sync-qa-fixes-plan.md
pr: https://github.com/PedroLages/knowlune/pull/416
branch: feature/ce-2026-04-24-abs-sync-qa-fixes
---

# ABS Sync QA Fix Patterns

## Context

During the 2026-04-24 QA pass on ABS (Audiobookshelf) sync, several independent issues surfaced: a hang on initial shelf resolution, Supabase cover downloads 429'ing under burst, auth-failed loops silently retrying, a Dexie schema add that risked breaking existing users, a duplicated Radix `TooltipProvider`, and broken cover images with no fallback. Each issue produced a reusable pattern worth capturing.

## Guidance

### 1. shelvesResolve deadlock — outer try/finally guard

When a `Promise.all([…, shelvesResolve])` awaits a promise that may never settle (dependency on an external event, race, or a callback that silently drops), wrap the *producer* (not the caller) in `try/finally` and always resolve/reject the deferred inside `finally`. The caller cannot unhang itself; only the producer can guarantee settlement.

```ts
// Producer pattern — always settle
let resolveShelves!: (v: Shelf[]) => void;
let rejectShelves!: (e: unknown) => void;
const shelvesResolve = new Promise<Shelf[]>((res, rej) => {
  resolveShelves = res; rejectShelves = rej;
});

try {
  const shelves = await fetchShelves();
  resolveShelves(shelves);
} catch (err) {
  rejectShelves(err);
} finally {
  // Safety net: if neither branch fired (thrown sync error, early return),
  // settle with empty so Promise.all doesn't hang forever.
  resolveShelves([]);
}
```

`resolve` after `resolve`/`reject` is a no-op, so the `finally` net is safe.

### 2. Supabase 429 throttle — inline semaphore + exponential backoff

Do not add a dependency (p-limit, bottleneck) for simple fan-out throttling. An inline semaphore + retry-with-backoff covers 99% of cases:

```ts
function makeSemaphore(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const acquire = () => new Promise<void>((r) => {
    if (active < max) { active++; r(); } else queue.push(r);
  });
  const release = () => {
    active--;
    const next = queue.shift();
    if (next) { active++; next(); }
  };
  return { acquire, release };
}

const sem = makeSemaphore(4); // cap concurrent Supabase calls

async function downloadWithRetry(path: string, attempt = 0): Promise<Blob> {
  await sem.acquire();
  try {
    const { data, error } = await supabase.storage.from('covers').download(path);
    if (error?.statusCode === 429 && attempt < 5) {
      const delay = 2 ** attempt * 250 + Math.random() * 100; // jittered
      await new Promise((r) => setTimeout(r, delay));
      return downloadWithRetry(path, attempt + 1);
    }
    if (error) throw error;
    return data;
  } finally {
    sem.release();
  }
}
```

Key detail: release in `finally` so an exception doesn't leak a permit.

### 3. auth-failed sync guard — check first, surface loudly

Sync loops that quietly retry on 401 waste bandwidth and hide broken credentials. Guard at the entry of every sync cycle:

```ts
if (syncStatus.auth === 'failed') {
  toast.error('ABS credentials expired. Please reconnect.');
  openReconnectDialog();
  return; // short-circuit — do not fire API calls
}
```

Pair with a dedicated reconnect dialog so the user has a one-click path back to healthy.

### 4. Dexie additive migration (v60) — never mutate, only add

New stores bump the version and declare themselves alongside all prior stores. Do **not** omit older stores in the new version spec — Dexie treats that as a drop.

```ts
db.version(60).stores({
  // ...all existing stores repeated verbatim...
  absShelves: '&id, libraryId, updatedAt',
  absShelfItems: '&[shelfId+itemId], shelfId, itemId',
});
// No upgrade callback needed — these are new stores with no backfill.
```

Additive migrations are safe without an `.upgrade()` handler. Only add one when you need to transform existing rows.

### 5. TooltipProvider scope — trust shadcn's internal Provider

shadcn's `<Tooltip>` wraps a Radix `TooltipProvider` internally. Mounting a second `TooltipProvider` per-usage (or repeatedly inside a list) causes redundant context and, in some layouts, double-mount warnings. Mount one app-level Provider in `App.tsx` (for global delayDuration config) or rely on the per-tooltip internal Provider — never both in the same subtree.

```tsx
// ❌ Redundant
<TooltipProvider><Tooltip>…</Tooltip></TooltipProvider>

// ✅ Sufficient
<Tooltip>…</Tooltip>
```

### 6. BookCoverImage fallback — onError + initials glyph

Covers fail for many reasons (404, CORS, Supabase 429, expired signed URL). Never ship an `<img>` without a graceful fallback:

```tsx
function BookCoverImage({ src, title, author }: Props) {
  const [errored, setErrored] = useState(false);
  if (errored || !src) {
    const initials = title.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
    return (
      <div className="flex items-center justify-center bg-muted text-muted-foreground rounded-md aspect-[2/3]">
        <BookIcon className="absolute opacity-20" />
        <span className="relative font-semibold">{initials}</span>
      </div>
    );
  }
  return <img src={src} alt={title} onError={() => setErrored(true)} loading="lazy" />;
}
```

## Why This Matters

- **Deadlock guard** — a single unresolved promise can freeze an entire sync cycle; the `finally` net costs one line and prevents unrecoverable user-facing hangs.
- **Inline throttle** — adds zero dependency surface, zero bundle cost, and behaves correctly under Supabase's 429 burst limits.
- **Auth guard** — prevents thrash, saves API quota, and turns silent failure into a clear user action.
- **Additive Dexie** — the #1 cause of data-loss regressions is re-declaring a version spec without listing pre-existing stores.
- **Tooltip scope** — duplicated Providers don't crash immediately; they cause subtle focus/portal bugs that are hard to diagnose later.
- **Cover fallback** — broken images are the most-reported "polish" issue; initials + glyph is visually acceptable in every theme.

## When to Apply

- Any deferred Promise whose `resolve`/`reject` lives in a callback — wrap producer in try/finally.
- Any fan-out to a rate-limited API (Supabase Storage, third-party REST) — semaphore + jittered backoff.
- Any background sync with credentials — short-circuit on `auth === 'failed'`.
- Any Dexie version bump — repeat all existing stores verbatim.
- Any shadcn Tooltip usage — do not add a per-usage Provider.
- Any remote `<img>` in the app — ship an `onError` fallback.

## References

- Plan: `docs/plans/2026-04-24-002-fix-abs-sync-qa-fixes-plan.md`
- PR: https://github.com/PedroLages/knowlune/pull/416
- Branch: `feature/ce-2026-04-24-abs-sync-qa-fixes` (merged)
