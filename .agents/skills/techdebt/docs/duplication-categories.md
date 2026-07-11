# Duplication Categories for Knowlune

9 categories tuned to the React 19 / TypeScript / Zustand / Dexie / Tailwind stack. Each category includes detection patterns, search locations, extraction targets, and parameterization strategy.

## Category 1: Zustand Async Load Boilerplate

**Search location:** `src/stores/`
**Extract to:** `src/lib/storeHelpers.ts`

**Detection pattern** — grep for the async load signature:
```
set\(\{ isLoading: true
```
Then confirm the surrounding structure: `set({isLoading:true, error:null})` → try → `await db.TABLE.toArray()` or `.where(...)` → `set({data, isLoading:false})` → catch → `set({isLoading:false, error: '...'})` → `console.error('[...Store]')`.

**Canonical example** (`src/stores/useBookmarkStore.ts:31-39`):
```typescript
loadBookmarks: async () => {
  set({ isLoading: true, error: null })
  try {
    const bookmarks = await db.bookmarks.toArray()
    set({ bookmarks: bookmarks.sort((a, b) => a.timestamp - b.timestamp), isLoading: false })
  } catch (error) {
    set({ isLoading: false, error: 'Failed to load bookmarks' })
    console.error('[BookmarkStore] Failed to load bookmarks:', error)
  }
}
```

**Shared module API example:**
```typescript
export async function asyncLoad<T>(
  set: (state: Partial<{ isLoading: boolean; error: string | null }>) => void,
  loader: () => Promise<T[]>,
  stateKey: string,
  options?: {
    postProcess?: (items: T[]) => T[]
    errorMessage?: string
    logPrefix?: string
  }
): Promise<void>
```

**Parameterization strategy:**
- `loader` callback covers different Dexie queries (`.toArray()`, `.where(...).toArray()`)
- `postProcess` callback covers sorting/filtering (some stores sort after load, others don't)
- `stateKey` determines which state field gets the data
- If a store needs more than these 3 variations, don't extract it

---

## Category 2: Optimistic Update + Rollback

**Search location:** `src/stores/`
**Extract to:** `src/lib/storeHelpers.ts`

**Detection pattern** — look for this sequence:
```
const (old|previous|current|backup)
set\({
try {
  await (persistWithRetry|db\.)
} catch {
  set\(\{ .*(old|previous|current|backup)
```

The pattern: save old state → optimistic set → try persist → catch rollback to old state.

**Shared module API example:**
```typescript
export async function optimisticUpdate<TState>(
  get: () => TState,
  set: (state: Partial<TState>) => void,
  optimisticState: Partial<TState>,
  persist: () => Promise<void>,
  options?: { rollbackFields?: (keyof TState)[] }
): Promise<void>
```

---

## Category 3: Dexie CRUD with Error Handling

**Search location:** `src/stores/`, `src/lib/`
**Extract to:** `src/lib/dexieCrud.ts`

**Detection patterns:**
```
await db\.\w+\.put\(
await db\.\w+\.add\(
await db\.\w+\.delete\(
await db\.\w+\.bulkPut\(
await persistWithRetry\(
```

Look for these wrapped in try/catch with `toast.error()` or `console.error()`.

**Shared module API example:**
```typescript
export async function dexiePut<T>(
  table: Table<T, string>,
  item: T,
  options?: { toast?: string; logPrefix?: string }
): Promise<void>

export async function dexieDelete(
  table: Table<unknown, string>,
  id: string,
  options?: { toast?: string; logPrefix?: string }
): Promise<void>
```

**Note:** `persistWithRetry` already exists at `src/lib/persistWithRetry.ts`. These helpers would wrap it with standardized toast/logging. Check if the new code already uses `persistWithRetry` — if yes, the duplication is only in the toast/logging layer.

---

## Category 4: Dialog Open/Close State

**Search location:** `src/app/components/`, `src/app/pages/`
**Extract to:** `src/hooks/useDialogState.ts`

**Detection pattern:**
```
useState\(false\).*[Oo]pen
onOpenChange
```

The pattern: `const [open, setOpen] = useState(false)` paired with a dialog component receiving `open` and `onOpenChange` props, often with a `useEffect` that resets form state when `open` changes.

**Shared module API example:**
```typescript
export function useDialogState(initialOpen = false): {
  open: boolean
  onOpenChange: (open: boolean) => void
  openDialog: () => void
  closeDialog: () => void
}
```

**Parameterization:** The hook itself is simple — the main value is consistency and reducing boilerplate. Form reset logic should remain in the component since it's always domain-specific.

---

## Category 5: Debounced Search/Filter

**Search location:** `src/app/pages/`, `src/app/components/`
**Extract to:** `src/hooks/useDebouncedSearch.ts`

**Detection pattern:**
```
setTimeout.*search\|filter\|query\|debounce
clearTimeout.*search\|filter\|query\|debounce
debouncedSearch\|debouncedQuery\|debouncedFilter
```

The pattern: `const [query, setQuery] = useState('')` + `const [debouncedQuery, setDebouncedQuery] = useState('')` + `useEffect` with `setTimeout(250ms)` + cleanup `clearTimeout`.

**Shared module API example:**
```typescript
export function useDebouncedValue<T>(value: T, delay?: number): T
```

**Note:** This is a common React pattern. Check if the project already has this in `src/hooks/` before creating a new one. If it doesn't exist, the generic `useDebouncedValue` covers both search and filter use cases.

---

## Category 6: Status Config Maps

**Search location:** `src/app/components/figma/`, `src/app/components/`
**Extract to:** `src/lib/statusConfig.ts`

**Detection pattern:**
```
Record<.*Status.*\{.*label.*className
const.*Config.*:.*Record<
```

Look for objects that map a status enum/union to display properties (`label`, `className`, `icon`, `color`).

**Example of duplication:**
```typescript
// In Component A:
const statusConfig: Record<ImportStatus, { label: string; className: string }> = { ... }
// In Component B:
const importStatusColors: Record<ImportStatus, string> = { ... }
```

**Shared module API:** Export named config maps per domain:
```typescript
export const importStatusConfig: Record<ImportStatus, StatusDisplay> = { ... }
export const completionStatusConfig: Record<CompletionStatus, StatusDisplay> = { ... }
```

**Parameterization:** None needed — these are static config objects. Just consolidate identical maps.

---

## Category 7: Try/Catch/Toast Error Pattern

**Search location:** `src/app/` (all tsx files)
**Extract to:** Extend `src/lib/toastHelpers.ts`

**Detection pattern:**
```
try \{[\s\S]*?\} catch.*\{[\s\S]*?toast\.error
```
Use multiline grep. The pattern: `try { await operation() } catch (error) { toast.error('Failed to...') }`.

**Note:** `src/lib/toastHelpers.ts` already has structured helpers (`toastError.saveFailed()`, `toastError.importFailed()`, etc.) and `toastPromise()`. Check if the new code's try/catch/toast pattern is already covered by these helpers. If yes, just rewire. If no, extend the helpers with a new method.

**When NOT to extract:** If the catch block has significant recovery logic beyond just showing a toast (e.g., state rollback, retry, cleanup), don't extract it — the recovery logic is domain-specific.

---

## Category 8: Type Declarations

**Search location:** `src/` (all ts/tsx files)
**Extract to:** `src/types/` or `src/data/types.ts`

**Detection pattern:**
```
export (type|interface) \w+
```

Then compare: if two files export types with the same name, or types with different names but identical shape (same keys and value types), they're duplicates.

**Common duplicates to watch for:**
- Entity types (Course, Lesson, Note, etc.) defined locally instead of imported from `src/data/types.ts`
- Component prop interfaces that duplicate a shared type's shape
- Utility types (like `WithId<T>`, `Nullable<T>`) reinvented inline

**Strategy:** Always prefer importing from the canonical location (`src/data/types.ts` for entities, `src/types/` for utility types) over creating new type files.

---

## Category 9: Utility Functions

**Search location:** `src/` (all ts/tsx files)
**Extract to:** `src/lib/` (appropriate existing file or new file)

**Detection pattern:** Any `function` or `const` arrow function that:
- Performs string manipulation (regex, split, join, replace, template literals)
- Formats dates or durations
- Performs array operations (sort, filter, reduce, groupBy)
- Validates input (email, URL, phone, file type)
- Handles environment checks or feature flags
- Processes paths or URLs

**Strategy:**
1. First check if `src/lib/` already has a file covering this domain (e.g., `format.ts`, `textUtils.ts`, `searchUtils.ts`)
2. If yes, add the function to the existing file
3. If no, create a new file with a descriptive name matching the existing naming convention

**Naming convention for new files:** camelCase, domain-descriptive:
- `src/lib/arrayUtils.ts` (not `utils.ts` or `helpers.ts`)
- `src/lib/urlParser.ts` (not `parser.ts`)

---

## Similarity Classification

When scanning, classify each match:

| Level | Definition | Action |
|-------|-----------|--------|
| **Exact** | Identical code after whitespace normalization | Extract immediately |
| **Near-duplicate** | Same logic, different variable/function names | Extract with unified naming |
| **Analogous** | Same structural pattern, different domain | Extract with generics/callbacks |
| **Similar** | ~80% overlap with domain-specific twist | Extract common 80% if twist fits in 1-2 params; skip if >3 params |

For analogous matches (the highest-value category), count instances across the codebase. A pattern appearing in 5+ stores is a strong extraction signal even if each instance has minor variations.
