import { useCallback } from 'react'
import { FileText, ExternalLink } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { useIsMobile } from '@/app/components/ui/use-mobile'
import { Sheet, SheetContent, SheetTitle } from '@/app/components/ui/sheet'
import { usePdfViewerState } from './usePdfViewerState'
import { usePdfSearch } from './usePdfSearch'
import { PdfToolbar } from './PdfToolbar'
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
}: PdfViewerProps) {
  const state = usePdfViewerState(initialPage, onPageChange)
  const search = usePdfSearch(state.pdfDocument, state.goToPage)
  const isMobile = useIsMobile()

  const toggleSearch = useCallback(() => {
    if (search.searchOpen) {
      search.closeSearch()
    } else {
      search.openSearch()
    }
  }, [search])

  // Wrap handleKeyDown to intercept Ctrl+F for search
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    },
    [state.handleKeyDown, search]
  )

  if (state.loadError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted p-12">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {title || 'PDF Document'}
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          Unable to preview this document inline
        </p>
        <Button variant="outline" size="sm" onClick={() => window.open(src, '_blank')}>
          <ExternalLink className="mr-2 h-4 w-4" />
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
    <PdfOutlinePanel
      pdfDocument={state.pdfDocument}
      onPageClick={state.goToPage}
    />
  )

  return (
    <div
      ref={state.containerRef}
      data-testid="pdf-viewer"
      role="document"
      aria-label={`PDF viewer: ${title || 'document'}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex flex-col overflow-hidden rounded-[24px] border border-border bg-card focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
        className
      )}
    >
      <PdfToolbar
        src={src}
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
      />

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

      {/* ARIA live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {state.announcement}
      </div>
    </div>
  )
}
