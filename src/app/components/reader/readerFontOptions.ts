/**
 * Reader typeface options — applied inside the EPUB iframe via rendition.themes.
 * Preview stacks for settings UI; `epubStack` is injected as body font-family.
 *
 * Curation: Literata (TypeTogether for Google, screen-first e‑reading; OFL, variable in project).
 * Inter: modern UI sans (variable, bundled). Atkinson: Braille Institute hyperlegible.
 * Georgia: ubiquitous system book serif. DM Sans: app default sans (variable, bundled).
 */
import type { ReaderFontFamily } from '@/stores/useReaderStore'

export interface ReaderFontOption {
  value: ReaderFontFamily
  label: string
  description: string
  /** Shown in the settings picker; approximates the EPUB look */
  previewFontFamily: string
  /** Passed to epub.js `body` `font-family` (same as `applyTheme` map) */
  epubFontFamily: string
}

export const READER_FONT_OPTIONS: ReaderFontOption[] = [
  {
    value: 'default',
    label: 'Book default',
    description: 'Respect the EPUB’s fonts when available',
    previewFontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
    epubFontFamily: 'inherit',
  },
  {
    value: 'literata',
    label: 'Literata',
    description: 'Screen-optimized serif (used in Google Play Books)',
    previewFontFamily: "'Literata', Georgia, 'Times New Roman', serif",
    epubFontFamily: "'Literata', Georgia, 'Times New Roman', serif",
  },
  {
    value: 'inter',
    label: 'Inter',
    description: 'Modern neutral variable sans',
    previewFontFamily: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif",
    epubFontFamily: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif",
  },
  {
    value: 'serif',
    label: 'Georgia',
    description: 'System serif, no download',
    previewFontFamily: 'Georgia, "Times New Roman", serif',
    epubFontFamily: 'Georgia, "Times New Roman", serif',
  },
  {
    value: 'sans',
    label: 'DM Sans',
    description: 'Same sans as the Knowlune app',
    previewFontFamily: "'DM Sans Variable', 'DM Sans', system-ui, -apple-system, sans-serif",
    epubFontFamily: "'DM Sans Variable', 'DM Sans', system-ui, -apple-system, sans-serif",
  },
  {
    value: 'atkinson',
    label: 'Atkinson Hyperlegible',
    description: 'Accessibility-first (Braille Institute)',
    previewFontFamily: "'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif",
    epubFontFamily: "'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif",
  },
  {
    value: 'mono',
    label: 'Monospace',
    description: 'Code-friendly fixed-width stack',
    previewFontFamily: 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace',
    epubFontFamily: 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace',
  },
]

const OPTION_MAP: Partial<Record<ReaderFontFamily, ReaderFontOption>> = Object.fromEntries(
  READER_FONT_OPTIONS.map(o => [o.value, o])
) as Partial<Record<ReaderFontFamily, ReaderFontOption>>

export function getReaderFontEpubStack(family: ReaderFontFamily): string {
  return OPTION_MAP[family]?.epubFontFamily ?? 'inherit'
}

export function getReaderFontOption(
  family: ReaderFontFamily
): ReaderFontOption | undefined {
  return OPTION_MAP[family]
}
