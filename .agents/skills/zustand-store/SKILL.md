---
name: zustand-store
description: "Knowlune Zustand store patterns. Use when creating new Zustand stores or modifying existing ones — CRUD stores, UI state stores, sync stores, or auth stores. Triggered by tasks involving create<State>((set, get) => {...}), useXStore, or store-based state management."
---

# Zustand Store Patterns

Encodes Knowlune's 43-store conventions so agents create stores that are consistent, testable, and follow the same patterns as every existing store. Reference living examples in the codebase — read the source, don't trust memory.

## 1. Store Boilerplate

**Universal signature** — all 43 stores use `create` from `'zustand'` with a single combined interface. Reference `src/stores/useBookStore.ts:110`, `src/stores/useSessionStore.ts`.

```typescript
import { create } from 'zustand'

interface MyStoreState {
  // state fields
  // action methods
}

export const useMyStore = create<MyStoreState>((set, get) => ({
  // implementation
}))
```

**Rules:**
- Always destructure `(set, get)` — even if `get()` is unused
- Single combined interface (state + actions together) — not separate `State` + `Actions` + `&`
- Only 2 stores split state/actions into separate interfaces: `useAuthStore.ts` and `useWelcomeWizardStore.ts`
- Zero uses of `createWithEqualityFn`, `devtools`, `immer`, or `subscribeWithSelector`

## 2. State Shape

Every async store follows these canonical field names. Reference `src/stores/useQuizStore.ts:22-26`, `src/stores/useSessionStore.ts:40-43`.

```typescript
interface MyStoreState {
  // Data
  items: Item[]                   // collections → arrays (never ES6 Map)
  currentItem: Item | null        // single entity → T | null
  statusMap: Record<string, Status>  // keyed lookups → Record<K,V>

  // Loading/error (canonical names — never deviate)
  isLoading: boolean              // true during async operations
  error: string | null            // error message or null

  // Guard flag (for stores that load from DB)
  isLoaded: boolean               // prevents redundant fetches

  // Actions follow...
}
```

**Collection storage rules:**
- Use **arrays** (`T[]`) for ordered collections — most common
- Use **`Record<string, T>`** for keyed lookups — no ES6 `Map` (must be serializable)
- Use **`T | null`** for single nullable entities — not `undefined`

**`isLoaded` guard pattern** (reference `src/stores/useBookStore.ts:66`):
```typescript
loadItems: async () => {
  if (get().isLoaded) return  // guard prevents redundant DB reads
  set({ isLoading: true })
  const items = await db.items.toArray()
  set({ items, isLoaded: true, isLoading: false })
}
```

## 3. Action Patterns

### Template A: Optimistic Mutation (Canonical)

For create/update/delete — optimistic update with rollback. Reference `src/stores/useFlashcardStore.ts:78-95`, `src/stores/useQuizStore.ts:139-145`.

```typescript
addItem: async (item: Item) => {
  // 1. Optimistic update (set IMMEDIATELY)
  set(state => ({ items: [item, ...state.items] }))

  try {
    // 2. Persist through sync pipeline
    await persistWithRetry(async () => {
      await syncableWrite('tableName', 'add', item as unknown as SyncableRecord)
    })
    // 3. Success — optimistic state is already correct
  } catch (error) {
    // 4. Rollback on failure — choose strategy:
    // Strategy A: Snapshot rollback (for complex multi-field state)
    set({ ...snapshot, isLoading: false, error: 'Failed' })
    // Strategy B: Re-fetch from DB (for collection state)
    const items = await db.items.toArray()
    set({ items })
    toast.error('Failed to add item')
    console.error('[StoreName] Failed:', error)
  }
}
```

### Template B: Load Action

For reading data from Dexie. Reference `src/stores/useContentProgressStore.ts:72-86`.

```typescript
loadItems: async () => {
  if (get().isLoaded) return
  set({ isLoading: true, error: null })
  try {
    const items = await db.items.orderBy('createdAt').reverse().toArray()
    set({ items, isLoaded: true, isLoading: false })
  } catch (error) {
    set({ isLoading: false, error: 'Failed to load items' })
    console.error('[StoreName] Failed to load:', error)
  }
}
```

**Naming conventions:**
- `verbNoun`: `loadBooks`, `addItem`, `deleteNote`, `submitAnswer`
- `setNoun`: `setSelectedId`, `setFilter`, `setNotesOpen`
- `toggleNoun`: `toggleTheater`, `toggleReadingMode`
- `clearNoun`: `clearQuiz`, `clearError`
- `getNoun`: `getFilteredBooks` (derived state via method, not selector)

## 4. Immutability Discipline

Every state update must be immutable. Zustand detects changes via shallow comparison. Reference `src/stores/useSessionStore.ts:149` for an explicit example:

```typescript
// ✅ Immutable spread
set({
  activeSession: {
    ...activeSession,
    interactionCount: (activeSession.interactionCount ?? 0) + 1,
  },
})

// ❌ Direct mutation
activeSession.interactionCount += 1  // Zustand won't detect this
```

## 5. Selector Patterns

### Inline Arrow Selectors (Dominant Pattern)

Used by virtually every component. Reference `src/app/pages/Library.tsx:124-131`.

```typescript
const books = useBookStore(s => s.books)
const isLoading = useBookStore(s => s.isLoading)
const setFilter = useBookStore(s => s.setFilter)
```

**Rule**: One `useXStore(s => s.field)` per field. Never destructure multiple fields in a single selector.

### Exported Named Selectors (Cross-Store Use)

Only 2 stores export named selectors. Used when other stores (not components) need to read state. Reference `src/stores/useQuizStore.ts:380-384`, `src/stores/useAuthStore.ts:203-218`.

```typescript
export const selectCurrentQuiz = (state: QuizState) => state.currentQuiz
export const selectIsLoading = (state: QuizState) => state.isLoading
```

Called via `.getState()` — never import and call the hook:
```typescript
import { useAuthStore, selectIsGuestMode } from '@/stores/useAuthStore'
if (selectIsGuestMode(useAuthStore.getState())) { ... }
```

### `useShallow` (Rare — Derived Arrays Only)

Only one usage in the entire codebase (`src/app/pages/LearningTrackDetail.tsx:132-141`). Use only when a selector returns a derived array — prevents re-renders on referential inequality.

## 6. Persistence Middleware

Only 3 stores use `persist`. Reference `src/stores/useQuizStore.ts:300-328` for the canonical configuration:

```typescript
export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: 'levelup-quiz-store',
      storage: createJSONStorage(() => quotaResilientStorage),
      partialize: state => ({
        // Only persist what survives a refresh
        currentProgress: state.currentProgress,
        currentQuiz: state.currentQuiz,
      }),
      onRehydrateStorage: () => state => {
        // Migration: fix old data shapes
        if (!Array.isArray(state.currentProgress?.markedForReview)) {
          state.currentProgress = { ...state.currentProgress, markedForReview: [] }
        }
      },
    }
  )
)
```

**Only use `persist` when state must survive a page refresh.** Most stores are fine without it — Dexie is the source of truth.

## 7. Store-to-Store Communication

Use `.getState()` for cross-store reads. Reference `src/stores/useBookStore.ts:126`.

```typescript
// ✅ Read another store's state imperatively
const isGuest = selectIsGuestMode(useAuthStore.getState())

// ❌ Import and call another store's hook
const user = useAuthStore(s => s.user)  // don't do this inside another store
```

## Anti-Patterns to Avoid

| ❌ Wrong | ✅ Correct | Why |
|----------|-----------|-----|
| Direct `db.table.add()` in store | `persistWithRetry(() => syncableWrite(...))` | Bypasses sync queue |
| `{ status: 'idle' \| 'loading' \| ... }` | `isLoading: boolean` + `error: string \| null` | Breaks consistency with all 43 stores |
| ES6 `Map` in state | `Record<string, T>` | Not serializable, breaks shallow comparison |
| `createWithEqualityFn` | `create` | All existing stores use plain `create` |
| Multiple fields in one selector | One `s => s.field` per useStore call | Avoids unnecessary re-renders |
| Calling another store's hook | `useOtherStore.getState()` | Hooks can only be called in components |
| `useShallow` for primitive selectors | Plain arrow selector | `useShallow` is only for derived arrays |

## Key Reference Files

| File | What it teaches |
|------|----------------|
| `src/stores/useBookStore.ts` | Full CRUD, isLoaded guard, re-fetch rollback, cross-store reads |
| `src/stores/useQuizStore.ts` | Persist middleware, snapshot rollback, exported selectors |
| `src/stores/useFlashcardStore.ts` | Optimistic create with sync integration |
| `src/stores/useSessionStore.ts` | Immutability discipline, canonical field names |
| `src/stores/useContentProgressStore.ts` | Record-based state, load action pattern |
| `src/stores/useAuthStore.ts` | State/action interface separation (rare pattern) |
| `src/app/pages/Library.tsx` | Inline arrow selector usage in components |
| `src/app/pages/LearningTrackDetail.tsx` | `useShallow` for derived array selector |
