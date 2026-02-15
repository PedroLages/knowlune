# Code Review Agent Memory

## Patterns Observed

### E01-S03: Organize Courses by Topic
- `normalizeTags()` in store lowercases and deduplicates, but `addImportedCourse()` does NOT normalize tags on import
- `getAllTags()` is a function on the Zustand store (not a selector), so calling it inside components with `state.getAllTags()()` triggers re-renders on every state change
- Test factories exist at `tests/support/fixtures/factories/` -- unit tests should use them instead of inline `makeCourse` functions
- The codebase uses `cn()` from `@/app/components/ui/utils` for class merging but new components use string interpolation instead
- `size-*` Tailwind v4 shorthand (`size-5` instead of `h-5 w-5`) not consistently adopted in new components

## Project Conventions
- Import alias: `@/` resolves to `./src`
- Card border radius: `rounded-[24px]`
- Button border radius: `rounded-xl`
- Primary CTA color: `bg-blue-600`
- shadcn/ui components in `src/app/components/ui/`
- Custom components in `src/app/components/figma/`
- Dexie.js DB defined in `src/db/schema.ts`, re-exported from `src/db/index.ts`
