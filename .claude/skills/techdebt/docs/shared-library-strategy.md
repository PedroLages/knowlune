# Shared Library Strategy

Rules for where to place extracted shared modules, how to name them, and how to design their APIs. All decisions match Knowlune's existing conventions.

## Placement Rules

| Artifact Type | Location | Naming Convention | Example |
|---------------|----------|------------------|---------|
| Pure functions (no React) | `src/lib/` | camelCase, domain-descriptive | `storeHelpers.ts`, `dexieCrud.ts` |
| React hooks | `src/hooks/` | `use{PascalCase}.ts` | `useDialogState.ts`, `useDebouncedValue.ts` |
| TypeScript types/interfaces | `src/types/` or `src/data/types.ts` | PascalCase | `StoreTypes.ts` |
| Constants/config maps | `src/lib/` | camelCase | `statusConfig.ts` |

**Existing shared modules to extend (prefer these over new files):**
- `src/lib/toastHelpers.ts` — toast notification wrappers
- `src/lib/format.ts` — formatting utilities
- `src/lib/textUtils.ts` — string manipulation
- `src/lib/searchUtils.ts` — search/highlight utilities
- `src/lib/persistWithRetry.ts` — Dexie error handling
- `src/lib/dateUtils.ts` — date utilities
- `src/data/types.ts` — entity type definitions

**Rules:**
- No barrel exports (the project uses direct file imports, not `index.ts` re-exports)
- All imports use the `@/` alias: `import { fn } from '@/lib/storeHelpers'`
- Never create a file named `utils.ts` or `helpers.ts` at the top level — always domain-prefix

## Import Hierarchy (Circular Dependency Prevention)

The project follows this unidirectional import hierarchy:

```
src/types/  →  src/lib/  →  src/stores/  →  src/hooks/  →  src/app/components/  →  src/app/pages/
```

**Critical rules:**
- `src/lib/` must NEVER import from `src/stores/` or `src/hooks/` or `src/app/`
- `src/hooks/` must NEVER import from `src/app/`
- `src/stores/` can import from `src/lib/` and `src/types/` only
- If a helper needs a store's type, move that type to `src/types/` first

**Checking for circular deps before extraction:**
1. List the imports of the file where you'll place the shared module
2. List the imports of the consumers you're updating
3. Confirm no cycle: shared module does not import from any consumer's module layer

## API Design Principles

### 1. Minimum Parameters
Accept only what the function needs. Don't pass entire store state or component props when a single value suffices.

```typescript
// BAD: takes entire store state
function asyncLoad(state: BookmarkState, set: SetState): Promise<void>

// GOOD: takes only what's needed
function asyncLoad<T>(
  set: (partial: Partial<AsyncState>) => void,
  loader: () => Promise<T[]>,
  stateKey: string
): Promise<void>
```

### 2. Generics for Type-Agnostic Patterns
When the pattern works identically across different entity types, use TypeScript generics.

```typescript
// Works for bookmarks, notes, flashcards, etc.
async function asyncLoad<T>(
  set: SetFn,
  loader: () => Promise<T[]>,
  stateKey: string
): Promise<void>
```

### 3. Callbacks for Domain-Specific Variations
When instances differ by 1-2 behaviors (sorting, filtering, transforming), parameterize via callbacks.

```typescript
async function asyncLoad<T>(
  set: SetFn,
  loader: () => Promise<T[]>,
  stateKey: string,
  options?: {
    postProcess?: (items: T[]) => T[]    // sorting, filtering
    errorMessage?: string                 // custom error text
    logPrefix?: string                    // '[BookmarkStore]'
  }
): Promise<void>
```

### 4. The >3 Parameter Rule
If parameterizing a pattern requires more than 3 additional parameters (beyond the core ones), the pattern is too domain-specific. Skip the extraction.

### 5. Same Return Shape
The shared function must return the same shape the inline code produced. Consumers should need only import changes, not logic restructuring.

### 6. No Behavior Changes During Extraction
The extracted module must produce identical runtime behavior. Don't add error handling, logging, or features that the inline code didn't have. Extraction is structural only.

## Adding to Existing Files

When extending an existing shared module:
- Add the new export at the end of the file
- Follow the file's existing style (JSDoc, naming, parameter order)
- Don't refactor existing functions — only add new ones
- Don't change existing function signatures (breaking change risk)

## Creating New Files

When creating a new shared module:
- Add a brief module-level JSDoc comment (1-2 lines) explaining the file's purpose
- Export all public functions explicitly (no default exports)
- Group related functions together
- Match the style of `src/lib/toastHelpers.ts` as reference:
  - Typed config objects for variants
  - Clear function signatures with JSDoc for non-obvious parameters
  - Domain-specific wrappers that call through to generic implementations
