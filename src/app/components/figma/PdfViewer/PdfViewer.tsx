import { useState } from 'react'
import { FileText, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { useIsMobile } from '@/app/components/ui/use-mobile'
import { Sheet, SheetContent, SheetTitle } from '@/app/components/ui/sheet'
import { usePdfViewerState } from './usePdfViewerState'
import { usePdfSearch } from './usePdfSearch'
import { PdfToolbar, openBlobPdfInNewTab } from './PdfToolbar'
import { PdfPageRenderer } from './PdfPageRenderer'
import { PdfScrollView } from './PdfScrollView'
import { PdfSearchBar } from './PdfSearchBar'
import { PdfThumbnailSidebar } from './PdfThumbnailSidebar'
import { PdfOutlinePanel } from './PdfOutlinePanel'
import type { PdfViewerProps } from './types'

export function PdfViewer({
  src,
  title,
  initialPage = 1,
  onPageChange,
  className,
  compact,
  collapsible,
}: PdfViewerProps) {
  const state = usePdfViewerState(initialPage, onPageChange)
  const search = usePdfSearch(state.pdfDocument, state.goToPage)
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)

  const toggleCollapsed = () => setCollapsed(prev => !prev)

  const toggleSearch = () => {
    if (search.searchOpen) {
      search.closeSearch()
    } else {
      search.openSearch()
    }
  }

  // Wrap handleKeyDown to intercept Ctrl+F for search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      search.openSearch()
      return
    }
    if (e.key === 'Escape' && search.searchOpen) {
      e.preventDefault()
      search.closeSearch()
      return
    }
    state.handleKeyDown(e)
  }

  if (state.loadError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted p-12">
        <FileText className="mb-4 size-12 text-muted-foreground" />
        <p className="mb-2 text-sm font-medium text-muted-foreground">{title || 'PDF Document'}</p>
        <p className="mb-4 text-xs text-muted-foreground">Unable to preview this document inline</p>
        <Button variant="outline" size="sm" onClick={() => openBlobPdfInNewTab(src, title)}>
          <ExternalLink className="mr-2 size-4" />
          Open in New Tab
        </Button>
      </div>
    )
  }

  const thumbnailContent = state.totalPages > 0 && (
    <PdfThumbnailSidebar
      src={src}
      totalPages={state.totalPages}
      currentPage={state.currentPage}
      onPageClick={state.goToPage}
    />
  )

  const outlineContent = (
    <PdfOutlinePanel pdfDocument={state.pdfDocument} onPageClick={state.goToPage} />
  )

  const isCollapsed = collapsible && collapsed

  return (
    <div
      ref={state.containerRef}
      data-testid="pdf-viewer"
      role="document"
      aria-label={`PDF viewer: ${title || 'document'}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-border bg-card focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
        className
      )}
    >
      <PdfToolbar
        src={src}
        title={title}
        currentPage={state.currentPage}
        totalPages={state.totalPages}
        scale={state.scale}
        zoomMode={state.zoomMode}
        zoomDropdownOpen={state.zoomDropdownOpen}
        pageInputValue={state.pageInputValue}
        darkMode={state.darkMode}
        dropdownRef={state.dropdownRef}
        goToPage={state.goToPage}
        zoomIn={state.zoomIn}
        zoomOut={state.zoomOut}
        setZoomPreset={state.setZoomPreset}
        fitWidth={state.fitWidth}
        fitPage={state.fitPage}
        setZoomDropdownOpen={state.setZoomDropdownOpen}
        handlePageInputChange={state.handlePageInputChange}
        handlePageInputKeyDown={state.handlePageInputKeyDown}
        commitPageInput={state.commitPageInput}
        displayZoom={state.displayZoom}
        rotateClockwise={state.rotateClockwise}
        toggleDarkMode={state.toggleDarkMode}
        thumbnailsOpen={state.thumbnailsOpen}
        outlineOpen={state.outlineOpen}
        toggleThumbnails={state.toggleThumbnails}
        toggleOutline={state.toggleOutline}
        searchOpen={search.searchOpen}
        toggleSearch={toggleSearch}
        scrollMode={state.scrollMode}
        toggleScrollMode={state.toggleScrollMode}
        isFullscreen={state.isFullscreen}
        toggleFullscreen={state.toggleFullscreen}
        compact={compact}
        collapsible={collapsible}
        collapsed={collapsed}
        toggleCollapsed={toggleCollapsed}
      />

      {/* Collapsible content area */}
      {!isCollapsed && (
        <>
          {/* Search bar */}
          {search.searchOpen && (
            <PdfSearchBar
              searchQuery={search.searchQuery}
              matches={search.matches}
              activeMatchIndex={search.activeMatchIndex}
              isExtracting={search.isExtracting}
              setSearchQuery={search.setSearchQuery}
              nextMatch={search.nextMatch}
              prevMatch={search.prevMatch}
              closeSearch={search.closeSearch}
            />
          )}

          {/* Main content area with optional side panels */}
          <div className="flex min-h-0 flex-1">
            {/* Thumbnail sidebar — inline on desktop, Sheet on mobile */}
            {!compact && !isMobile && state.thumbnailsOpen && (
              <aside className="w-[152px] shrink-0 border-r border-border overflow-y-auto">
                {thumbnailContent}
              </aside>
            )}

            {/* Single page or continuous scroll */}
            {state.scrollMode === 'single' ? (
              <div className="group/nav relative flex min-w-0 flex-1 flex-col">
                <PdfPageRenderer
                  src={src}
                  currentPage={state.currentPage}
                  scale={state.scale}
                  rotation={state.rotation}
                  darkMode={state.darkMode}
                  isFullscreen={state.isFullscreen}
                  isLoading={state.isLoading}
                  contentRef={state.contentRef}
                  onDocumentLoadSuccess={state.handleDocumentLoadSuccess}
                  onDocumentLoadError={state.handleDocumentLoadError}
                  onPageLoadSuccess={state.handlePageLoadSuccess}
                  customTextRenderer={search.makeTextRenderer(state.currentPage)}
                />

                {/* Floating bottom navigation bar */}
                {state.totalPages > 1 && !state.isLoading && (
                  <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    <div className="flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-1 shadow-lg backdrop-blur-md">
                      <button
                        onClick={() => state.goToPage(state.currentPage - 1)}
                        disabled={state.currentPage <= 1}
                        aria-label="Previous page"
                        className="flex size-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent sm:h-7 sm:w-7"
                      >
                        <ChevronLeft className="size-4" />
                      </button>

                      <span className="min-w-[4rem] select-none text-center text-xs font-medium text-white">
                        {state.currentPage} / {state.totalPages}
                      </span>

                      <button
                        onClick={() => state.goToPage(state.currentPage + 1)}
                        disabled={state.currentPage >= state.totalPages}
                        aria-label="Next page"
                        className="flex size-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent sm:h-7 sm:w-7"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
                      <div
                        className="h-full rounded-full bg-white/80 transition-[width] duration-200"
                        style={{ width: `${(state.currentPage / state.totalPages) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <PdfScrollView
                src={src}
                totalPages={state.totalPages}
                currentPage={state.currentPage}
                scale={state.scale}
                rotation={state.rotation}
                darkMode={state.darkMode}
                isFullscreen={state.isFullscreen}
                pageWidth={state.pageWidth}
                pageHeight={state.pageHeight}
                onPageChange={state.goToPage}
                onDocumentLoadSuccess={state.handleDocumentLoadSuccess}
                onDocumentLoadError={state.handleDocumentLoadError}
                makeTextRenderer={search.makeTextRenderer}
              />
            )}

            {/* Outline panel — inline on desktop, Sheet on mobile */}
            {!compact && !isMobile && state.outlineOpen && (
              <aside className="w-[220px] shrink-0 border-l border-border overflow-y-auto">
                {outlineContent}
              </aside>
            )}
          </div>

          {/* Mobile sheets */}
          {!compact && isMobile && (
            <>
              <Sheet open={state.thumbnailsOpen} onOpenChange={state.setThumbnailsOpen}>
                <SheetContent side="left" className="w-[200px] p-0">
                  <SheetTitle className="sr-only">Page thumbnails</SheetTitle>
                  {thumbnailContent}
                </SheetContent>
              </Sheet>

              <Sheet open={state.outlineOpen} onOpenChange={state.setOutlineOpen}>
                <SheetContent side="right" className="w-[260px] p-0">
                  <SheetTitle className="sr-only">Document outline</SheetTitle>
                  {outlineContent}
                </SheetContent>
              </Sheet>
            </>
          )}
        </>
      )}

      {/* ARIA live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {state.announcement}
      </div>
    </div>
  )
}
