import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Maximize,
  Minimize,
  ChevronsLeftRight,
  Maximize2,
  Download,
  Printer,
  RotateCw,
  Moon,
  Sun,
  MoreHorizontal,
  PanelLeft,
  BookOpen,
  Search,
  Rows3,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { ZOOM_PRESETS, ZOOM_LABELS, type ZoomMode, type ScrollMode } from './types'

interface PdfToolbarProps {
  src: string
  title?: string
  currentPage: number
  totalPages: number
  scale: number
  zoomMode: ZoomMode
  zoomDropdownOpen: boolean
  pageInputValue: string
  darkMode: boolean
  dropdownRef: React.RefObject<HTMLDivElement | null>
  goToPage: (page: number) => void
  zoomIn: () => void
  zoomOut: () => void
  setZoomPreset: (value: number) => void
  fitWidth: () => void
  fitPage: () => void
  setZoomDropdownOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  handlePageInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handlePageInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  commitPageInput: () => void
  displayZoom: () => string
  rotateClockwise: () => void
  toggleDarkMode: () => void
  thumbnailsOpen: boolean
  outlineOpen: boolean
  toggleThumbnails: () => void
  toggleOutline: () => void
  searchOpen: boolean
  toggleSearch: () => void
  scrollMode: ScrollMode
  toggleScrollMode: () => void
  isFullscreen: boolean
  toggleFullscreen: () => void
  compact?: boolean
  collapsible?: boolean
  collapsed?: boolean
  toggleCollapsed?: () => void
}

function handlePrint(src: string) {
  const w = window.open(src, '_blank')
  if (w) {
    w.addEventListener('load', () => w.print(), { once: true })
  }
}

export function PdfToolbar({
  src,
  title,
  currentPage,
  totalPages,
  scale,
  zoomMode,
  zoomDropdownOpen,
  pageInputValue,
  darkMode,
  dropdownRef,
  goToPage,
  zoomIn,
  zoomOut,
  setZoomPreset,
  fitWidth,
  fitPage,
  setZoomDropdownOpen,
  handlePageInputChange,
  handlePageInputKeyDown,
  commitPageInput,
  displayZoom,
  rotateClockwise,
  toggleDarkMode,
  thumbnailsOpen,
  outlineOpen,
  toggleThumbnails,
  toggleOutline,
  searchOpen,
  toggleSearch,
  scrollMode,
  toggleScrollMode,
  isFullscreen,
  toggleFullscreen,
  compact,
  collapsible,
  collapsed,
  toggleCollapsed,
}: PdfToolbarProps) {
  return (
    <div
      data-testid="pdf-toolbar"
      role="toolbar"
      aria-label="PDF controls"
      className="flex flex-wrap items-center gap-1 border-b border-border bg-muted px-2 py-1.5 sm:gap-2 sm:px-3"
    >
      {/* Collapse toggle */}
      {collapsible && (
        <Button
          data-testid="pdf-toggle-collapse"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand PDF viewer' : 'Collapse PDF viewer'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </Button>
      )}

      {/* Title (always when collapsed, hidden on small screens when expanded) */}
      {title && (
        <span
          className={`truncate text-sm font-medium ${collapsed ? 'max-w-[200px]' : 'hidden max-w-[140px] sm:inline'}`}
        >
          {title}
        </span>
      )}

      {/* Separator after title */}
      {title && !collapsed && <div className="hidden h-5 w-px bg-border sm:block" />}

      {/* Panel toggles */}
      {!compact && !collapsed && (
        <div className="hidden items-center gap-1 sm:flex">
          <Button
            data-testid="pdf-toggle-thumbnails"
            variant={thumbnailsOpen ? 'secondary' : 'ghost'}
            size="icon"
            className="size-8"
            onClick={toggleThumbnails}
            aria-label={thumbnailsOpen ? 'Hide thumbnails' : 'Show thumbnails'}
            aria-pressed={thumbnailsOpen}
            title="Thumbnails"
          >
            <PanelLeft className="size-4" />
          </Button>

          <Button
            data-testid="pdf-toggle-outline"
            variant={outlineOpen ? 'secondary' : 'ghost'}
            size="icon"
            className="size-8"
            onClick={toggleOutline}
            aria-label={outlineOpen ? 'Hide outline' : 'Show outline'}
            aria-pressed={outlineOpen}
            title="Outline"
          >
            <BookOpen className="size-4" />
          </Button>

          {/* Separator */}
          <div className="h-5 w-px bg-border" />
        </div>
      )}

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <Button
          data-testid="pdf-prev-page"
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-8 sm:w-8"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div data-testid="pdf-page-indicator" className="flex items-center gap-1 text-sm">
          <input
            data-testid="pdf-page-input"
            type="number"
            min={1}
            max={totalPages}
            value={pageInputValue}
            onChange={handlePageInputChange}
            onKeyDown={handlePageInputKeyDown}
            onBlur={commitPageInput}
            aria-label="Current page"
            className="w-10 rounded border border-border bg-background px-1 py-0.5 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-muted-foreground">/</span>
          <span data-testid="pdf-total-pages" className="text-muted-foreground">
            {totalPages}
          </span>
        </div>

        <Button
          data-testid="pdf-next-page"
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-8 sm:w-8"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Everything below hidden when collapsed */}
      {!collapsed && (
        <>
          {/* Separator */}
          <div className="hidden h-5 w-px bg-border sm:block" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <Button
              data-testid="pdf-zoom-out"
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              onClick={zoomOut}
              aria-label="Zoom out"
            >
              <ZoomOut className="size-4" />
            </Button>

            {/* Zoom dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                data-testid="pdf-zoom-select"
                onClick={() => setZoomDropdownOpen(o => !o)}
                className="flex h-11 sm:h-8 items-center rounded px-2 text-sm hover:bg-accent"
                aria-label="Zoom level"
                aria-expanded={zoomDropdownOpen}
                aria-haspopup="listbox"
              >
                {displayZoom()}
              </button>
              {zoomDropdownOpen && (
                <div
                  role="listbox"
                  aria-label="Zoom presets"
                  className="absolute left-0 top-full z-50 mt-1 min-w-[100px] rounded-md border border-border bg-popover py-1 shadow-md"
                >
                  {ZOOM_PRESETS.map(z => (
                    <button
                      key={z}
                      role="option"
                      aria-selected={zoomMode === 'custom' && Math.abs(scale - z) < 0.01}
                      onClick={() => setZoomPreset(z)}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      {ZOOM_LABELS[z]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              data-testid="pdf-zoom-in"
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              onClick={zoomIn}
              aria-label="Zoom in"
            >
              <ZoomIn className="size-4" />
            </Button>

            {/* Fit width / Fit page */}
            <Button
              data-testid="pdf-fit-width"
              variant={zoomMode === 'fit-width' ? 'secondary' : 'ghost'}
              size="icon"
              className="hidden h-11 w-11 sm:inline-flex sm:h-8 sm:w-8"
              onClick={fitWidth}
              aria-label="Fit to width"
              title="Fit to width"
            >
              <ChevronsLeftRight className="size-4" />
            </Button>

            <Button
              data-testid="pdf-fit-page"
              variant={zoomMode === 'fit-page' ? 'secondary' : 'ghost'}
              size="icon"
              className="hidden h-11 w-11 sm:inline-flex sm:h-8 sm:w-8"
              onClick={fitPage}
              aria-label="Fit to page"
              title="Fit to page"
            >
              <Maximize2 className="size-4" />
            </Button>
          </div>

          {/* Separator */}
          <div className="hidden h-5 w-px bg-border sm:block" />

          {/* Secondary actions */}
          <div className="hidden items-center gap-1 sm:flex">
            <Button
              data-testid="pdf-toggle-search"
              variant={searchOpen ? 'secondary' : 'ghost'}
              size="icon"
              className="size-8"
              onClick={toggleSearch}
              aria-label={searchOpen ? 'Close search' : 'Search'}
              aria-pressed={searchOpen}
              title="Search (Ctrl+F)"
            >
              <Search className="size-4" />
            </Button>

            {!compact && (
              <Button
                data-testid="pdf-toggle-scroll-mode"
                variant={scrollMode === 'continuous' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-8"
                onClick={toggleScrollMode}
                aria-label={scrollMode === 'single' ? 'Continuous scroll' : 'Single page'}
                title={scrollMode === 'single' ? 'Continuous scroll' : 'Single page'}
              >
                <Rows3 className="size-4" />
              </Button>
            )}

            <div className="h-5 w-px bg-border" />

            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={rotateClockwise}
              aria-label="Rotate clockwise"
              title="Rotate"
            >
              <RotateCw className="size-4" />
            </Button>

            <Button
              variant={darkMode ? 'secondary' : 'ghost'}
              size="icon"
              className="size-8"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Light mode' : 'Dark mode'}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => handlePrint(src)}
              aria-label="Print"
              title="Print"
            >
              <Printer className="size-4" />
            </Button>

            <a href={src} download aria-label="Download PDF" title="Download">
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <span>
                  <Download className="size-4" />
                </span>
              </Button>
            </a>
          </div>

          {/* Mobile overflow menu */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:hidden"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1">
              {!compact && (
                <>
                  <button
                    onClick={toggleThumbnails}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
                  >
                    <PanelLeft className="size-4" />
                    {thumbnailsOpen ? 'Hide thumbnails' : 'Thumbnails'}
                  </button>
                  <button
                    onClick={toggleOutline}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
                  >
                    <BookOpen className="size-4" />
                    {outlineOpen ? 'Hide outline' : 'Outline'}
                  </button>
                </>
              )}
              <button
                onClick={toggleSearch}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
              >
                <Search className="size-4" />
                {searchOpen ? 'Close search' : 'Search'}
              </button>
              {!compact && (
                <button
                  onClick={toggleScrollMode}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
                >
                  <Rows3 className="size-4" />
                  {scrollMode === 'single' ? 'Continuous scroll' : 'Single page'}
                </button>
              )}
              <div className="my-1 h-px bg-border" />
              <button
                onClick={rotateClockwise}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
              >
                <RotateCw className="size-4" /> Rotate
              </button>
              <button
                onClick={toggleDarkMode}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
              >
                {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {darkMode ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                onClick={() => handlePrint(src)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
              >
                <Printer className="size-4" /> Print
              </button>
              <a
                href={src}
                download
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
              >
                <Download className="size-4" /> Download
              </a>
              <button
                onClick={toggleFullscreen}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
              >
                {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </button>
            </PopoverContent>
          </Popover>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Fullscreen */}
      {!collapsed && (
        <Button
          data-testid="pdf-toggle-fullscreen"
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-8 sm:w-8"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </Button>
      )}

      {/* Open in new tab */}
      <Button
        data-testid="pdf-open-new-tab"
        variant="ghost"
        size="icon"
        className="h-11 w-11 sm:h-8 sm:w-8"
        onClick={() => window.open(src, '_blank')}
        aria-label="Open PDF in new tab"
        title="Open in new tab"
      >
        <ExternalLink className="size-4" />
      </Button>
    </div>
  )
}
