# Architecture: E06-S01 --- Create Learning Challenges

Reference document for the Challenges feature data layer, state management, components, validation, and routing.

---

## Data Layer

### Challenge type (`src/data/types.ts`)

```typescript
export type ChallengeType = 'completion' | 'time' | 'streak'

export interface Challenge {
  id: string                    // crypto.randomUUID()
  name: string                  // 1-60 chars
  type: ChallengeType
  targetValue: number           // > 0; integer for completion/streak, float OK for time
  deadline: string              // ISO 8601 date (YYYY-MM-DD)
  createdAt: string             // ISO 8601 timestamp
  currentProgress: number       // starts at 0 (updated by E06-S02)
  celebratedMilestones: number[] // e.g. [25, 50, 75, 100] (used by E06-S03)
}
```

### Dexie schema v8 (`src/db/schema.ts`)

```
challenges: 'id, type, deadline, createdAt'
```

- **Primary key**: `id` (string, application-generated UUID --- not auto-increment)
- **Indexed fields**: `type` (filter by challenge kind), `deadline` (sort/filter expiring), `createdAt` (default sort order)
- **EntityTable type**: `EntityTable<Challenge, 'id'>`
- **No auto-increment**: IDs are `crypto.randomUUID()` generated in the store before persist. This enables optimistic UI updates (ID known before DB write completes).

### `persistWithRetry` pattern (`src/lib/persistWithRetry.ts`)

```typescript
persistWithRetry(operation: () => Promise<void>, maxRetries = 3): Promise<void>
```

- Wraps any Dexie write with exponential backoff: 1s, 2s, 4s (capped at 8s)
- Throws after final retry failure --- caller handles rollback
- Shared utility across all Zustand stores that write to IndexedDB
- Handles transient failures: quota pressure, locked database, browser throttling

---

## State Management

### Zustand store (`src/stores/useChallengeStore.ts`)

```typescript
interface ChallengeState {
  challenges: Challenge[]
  isLoading: boolean
  error: string | null

  loadChallenges: () => Promise<void>
  addChallenge: (data: NewChallengeData) => Promise<void>
  deleteChallenge: (id: string) => Promise<void>
}
```

### Optimistic update pattern (addChallenge)

```
1. Build full Challenge object (UUID, createdAt, currentProgress=0, etc.)
2. Snapshot current challenges array
3. set({ challenges: [newChallenge, ...snapshot] })    // optimistic
4. await persistWithRetry(() => db.challenges.add(challenge))
5. On failure: set({ challenges: snapshot })           // rollback
6. Re-throw so caller (dialog) can show toast.error
```

Same pattern applies to `deleteChallenge`: filter out immediately, restore on failure.

### Load pattern

- `loadChallenges()`: `db.challenges.orderBy('createdAt').reverse().toArray()`
- Sets `isLoading` during fetch, `error` on failure
- Called in `useEffect` with cleanup flag (`ignore`) to prevent stale updates

### Error propagation

| Layer  | Error handling                                                    |
| ------ | ----------------------------------------------------------------- |
| Store  | Sets `error` state string, logs to console                        |
| Page   | Renders error card with "Retry" button calling `loadChallenges()` |
| Dialog | Catches store throw, shows `toast.error`                          |

---

## Component Architecture

### Component hierarchy

```
Challenges (page)
  +-- ChallengeCard (per challenge)
  +-- CreateChallengeDialog
        +-- Dialog (shadcn)
              +-- form with Input, Select, Label, Button
```

### Page component (`src/app/pages/Challenges.tsx`)

Four render states:

| State | Condition | UI |
|-------|-----------|-----|
| Error | `error !== null` | Error message + "Retry" button |
| Loading | `isLoading === true` | "Loading challenges..." text |
| Empty | `challenges.length === 0` | Target icon + "No challenges yet" + CTA button |
| List | `challenges.length > 0` | 2-column responsive grid of ChallengeCard |

**ChallengeCard** renders: name, type badge, target with unit, progress bar, days remaining/expired status.

### Dialog component (`src/app/components/challenges/CreateChallengeDialog.tsx`)

- Controlled open state via props (`open`, `onOpenChange`)
- Local form state: `name`, `type`, `target`, `deadline`, `errors`, `isSubmitting`
- Resets form on close (via `onOpenChange` wrapper)
- Submit disabled while `isSubmitting`
- Dynamic unit label updates based on selected type

---

## Validation Strategy

### Client-side validation rules (on submit)

| Field | Rule | Error message |
|-------|------|---------------|
| Name | Required, 1-60 chars (trimmed) | "Challenge name is required" / "Name must be 60 characters or less" |
| Type | Required (Select, no default) | "Please select a challenge type" |
| Target | Required, > 0, numeric | "Target must be greater than zero" |
| Target | Integer when type is `completion` or `streak` | "Target {unit} must be a whole number" |
| Deadline | Required | "Deadline is required" |
| Deadline | Must be in the future (> today at midnight) | "Deadline must be in the future" |

### Local date parsing pattern

Date-only strings (`YYYY-MM-DD`) are parsed as **local dates** using manual split:

```typescript
const [y, m, d] = dateStr.split('-').map(Number)
new Date(y, m - 1, d)
```

**Why not `new Date(dateStr)`**: Per ECMAScript spec, date-only strings (`"2025-03-15"`) are parsed as UTC midnight. In timezones west of UTC, this shifts to the previous day (e.g., `2025-03-14T17:00:00-07:00`). Manual parsing with `new Date(year, month, day)` creates a local midnight timestamp, avoiding the off-by-one bug.

Used in both `Challenges.tsx` (display: `formatDeadline`, `daysRemaining`) and `CreateChallengeDialog.tsx` (validation: future date check).

### Accessibility

- Error messages wrapped in `<p role="alert">` (implicit `aria-live="assertive"`)
- Invalid inputs marked with `aria-invalid={true}`
- Error messages linked via `aria-describedby`
- All labels associated via `htmlFor` / `id` pairs
- Dialog handles focus trap + Escape key (Radix Dialog primitive)

---

## Routing & Navigation

### Route (`src/app/routes.tsx`)

```typescript
const Challenges = React.lazy(() =>
  import('./pages/Challenges').then(m => ({ default: m.Challenges }))
)

{ path: 'challenges', element: <SuspensePage><Challenges /></SuspensePage> }
```

Lazy-loaded with named export pattern (`.then(m => ({ default: m.Challenges }))`).

### Sidebar navigation (`src/app/config/navigation.ts`)

```typescript
// In "Track" group, first item
{ name: 'Challenges', path: '/challenges', icon: Target }
```

Grouped under **Track** alongside Session History and Reports.

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Optimistic updates | Instant UI feedback --- user sees the new challenge immediately. Rollback on persist failure keeps data consistent. |
| `persistWithRetry` | IndexedDB writes can fail transiently (quota pressure, locked DB in another tab, browser throttling during background). Exponential backoff handles these without user intervention. |
| Local date parsing | ECMAScript spec parses `"YYYY-MM-DD"` as UTC midnight, which shifts to previous day in negative-offset timezones. Manual `new Date(y, m-1, d)` avoids this. |
| Integer validation for completion/streak | Fractional videos or days are nonsensical. Time (hours) allows decimals (e.g., 1.5 hours). |
| UUID generated in store, not Dexie auto-increment | Enables optimistic insert --- ID is known before the async DB write completes, so the UI can render immediately with a stable key. |
| `celebratedMilestones` in initial schema | Forward-compatible for E06-S03 milestone celebrations without a schema migration. Starts as empty array. |
| `currentProgress` in initial schema | Forward-compatible for E06-S02 progress tracking. Starts at 0. |
| Form resets on dialog close | Prevents stale form data when reopening. Handled in `onOpenChange` wrapper. |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/data/types.ts` | `Challenge`, `ChallengeType` type definitions |
| `src/db/schema.ts` | Dexie v8 schema with `challenges` table |
| `src/stores/useChallengeStore.ts` | Zustand store with optimistic updates |
| `src/app/pages/Challenges.tsx` | Page component (list, empty, error, loading states) |
| `src/app/components/challenges/CreateChallengeDialog.tsx` | Form dialog with validation |
| `src/app/routes.tsx` | `/challenges` route (lazy-loaded) |
| `src/app/config/navigation.ts` | Sidebar entry in Track group |
| `src/lib/persistWithRetry.ts` | Shared retry utility for Dexie writes |
