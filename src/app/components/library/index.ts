/**
 * Barrel export for Library shelf primitives (E116-S02).
 *
 * Scope is intentionally limited to shelf primitives — do NOT add every file
 * in this directory here. Keeping the public surface narrow prevents
 * accidental growth and keeps refactors safe.
 */
export { LibraryShelfHeading, ShelfSeeAllLink } from './LibraryShelfHeading'
export type {
  LibraryShelfHeadingProps,
  LibraryShelfHeadingLevel,
  ShelfSeeAllLinkProps,
} from './LibraryShelfHeading'

export { LibraryShelfRow } from './LibraryShelfRow'
export type { LibraryShelfRowProps } from './LibraryShelfRow'

export { LibraryShelves } from './LibraryShelves'
