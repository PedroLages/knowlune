/**
 * Shared width contract for shelf cards.
 *
 * Keep shelf audiobook cards visually aligned with the primary audiobook card
 * scale used in the main Library experience, instead of per-component ad-hoc
 * width classes.
 *
 * @deprecated Prefer `BOOK_TILE_SIZES` for rails that use the unified BookTile.
 */
export const LIBRARY_SHELF_CARD_WIDTH_CLASS = 'w-44 sm:w-48'

/**
 * BookTile variant sizing tokens.
 *
 * `small` (128×192): Recently Added / Discover shelves.
 * `denseContinue` (144×216): Continue Listening/Reading shelf.
 */
export const BOOK_TILE_SIZES = {
  small: {
    width: 'w-32',
    cover: 'w-32 aspect-[2/3]',
  },
  denseContinue: {
    width: 'w-36',
    cover: 'w-36 aspect-[2/3]',
  },
} as const
