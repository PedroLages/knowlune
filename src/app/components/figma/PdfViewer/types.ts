export type ZoomMode = 'fit-width' | 'fit-page' | 'custom'
export type ScrollMode = 'single' | 'continuous'

export interface PdfViewerProps {
  src: string
  title?: string
  initialPage?: number
  onPageChange?: (page: number, totalPages: number) => void
  className?: string
  /** Hide panel toggles (thumbnails, outline) and scroll mode — useful inside dialogs */
  compact?: boolean
}

export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const
export const ZOOM_LABELS: Record<number, string> = {
  0.25: '25%',
  0.5: '50%',
  0.75: '75%',
  1: '100%',
  1.25: '125%',
  1.5: '150%',
  2: '200%',
  3: '300%',
}
