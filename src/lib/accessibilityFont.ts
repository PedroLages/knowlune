const ACCESSIBILITY_FONT_FAMILY =
  "'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif"
const DEFAULT_FONT_FAMILY = "'DM Sans', system-ui, -apple-system, sans-serif"

/**
 * Dynamically loads the Atkinson Hyperlegible font (regular + bold) and
 * sets `--font-body` on `<html>` so all body text switches immediately.
 *
 * The `@fontsource/atkinson-hyperlegible` package is code-split by Vite --
 * the CSS/font files are only fetched when this function is first called.
 * Subsequent calls reuse the already-injected `@font-face` rules.
 */
export async function loadAccessibilityFont(): Promise<void> {
  await Promise.all([
    import('@fontsource/atkinson-hyperlegible/400.css'),
    import('@fontsource/atkinson-hyperlegible/700.css'),
  ])
  document.documentElement.style.setProperty('--font-body', ACCESSIBILITY_FONT_FAMILY)
}

/**
 * Restores `--font-body` to the default DM Sans stack.
 */
export function unloadAccessibilityFont(): void {
  document.documentElement.style.setProperty('--font-body', DEFAULT_FONT_FAMILY)
}
