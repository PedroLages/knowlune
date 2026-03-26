import { useState, useRef, useEffect } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ZOOM_PRESETS, ZOOM_LABELS, type ZoomMode, type ScrollMode } from './types'

export function usePdfViewerState(
  initialPage: number,
  onPageChange?: (page: number, totalPages: number) => void
) {
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [scale, setScale] = useState(1)
  const [zoomMode, setZoomMode] = useState<ZoomMode>('custom')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [containerWidth, setContainerWidth] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [pageWidth, setPageWidth] = useState(0)
  const [pageHeight, setPageHeight] = useState(0)
  const [zoomDropdownOpen, setZoomDropdownOpen] = useState(false)
  const [pageInputValue, setPageInputValue] = useState(String(initialPage))
  const [rotation, setRotation] = useState(0)
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [scrollMode, setScrollMode] = useState<ScrollMode>('single')
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('pdf-dark-mode') === 'true'
    } catch {
      // silent-catch-ok: localStorage fallback is non-critical
      return false
    }
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sync page input draft when currentPage changes externally (buttons, keyboard)
  useEffect(() => {
    setPageInputValue(String(currentPage))
  }, [currentPage])

  // Measure container
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(entry.contentRect.width)
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Compute fit scales when dimensions change
  useEffect(() => {
    if (!pageWidth || !containerWidth) return
    if (zoomMode === 'fit-width') {
      const padding = 32
      setScale((containerWidth - padding) / pageWidth)
    } else if (zoomMode === 'fit-page') {
      const padding = 32
      const sw = (containerWidth - padding) / pageWidth
      const sh = (containerHeight - padding) / pageHeight
      setScale(Math.min(sw, sh))
    }
  }, [zoomMode, containerWidth, containerHeight, pageWidth, pageHeight])

  // Close zoom dropdown on outside click
  useEffect(() => {
    if (!zoomDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setZoomDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [zoomDropdownOpen])

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages))
    if (clamped === currentPage) return
    setCurrentPage(clamped)
    setAnnouncement(`Page ${clamped} of ${totalPages}`)
    onPageChange?.(clamped, totalPages)
  }

  const handleDocumentLoadSuccess = (doc: PDFDocumentProxy) => {
    setPdfDocument(doc)
    setTotalPages(doc.numPages)
    setIsLoading(false)
    const startPage = Math.min(initialPage, doc.numPages)
    setCurrentPage(startPage)
    setAnnouncement(`PDF loaded. ${doc.numPages} pages. Showing page ${startPage}.`)
  }

  const handleDocumentLoadError = () => {
    setLoadError(true)
    setIsLoading(false)
  }

  const handlePageLoadSuccess = (page: { width: number; height: number }) => {
    if (!pageWidth) {
      setPageWidth(page.width)
      setPageHeight(page.height)
    }
  }

  const zoomIn = () => {
    const next = ZOOM_PRESETS.find(z => z > scale + 0.01)
    if (next) {
      setScale(next)
      setZoomMode('custom')
      setAnnouncement(`Zoom ${ZOOM_LABELS[next]}`)
    }
  }

  const zoomOut = () => {
    const prev = [...ZOOM_PRESETS].reverse().find(z => z < scale - 0.01)
    if (prev) {
      setScale(prev)
      setZoomMode('custom')
      setAnnouncement(`Zoom ${ZOOM_LABELS[prev]}`)
    }
  }

  const setZoomPreset = (value: number) => {
    setScale(value)
    setZoomMode('custom')
    setZoomDropdownOpen(false)
    setAnnouncement(`Zoom ${ZOOM_LABELS[value]}`)
  }

  const fitWidth = () => {
    setZoomMode('fit-width')
    setZoomDropdownOpen(false)
    setAnnouncement('Fit to width')
  }

  const fitPage = () => {
    setZoomMode('fit-page')
    setZoomDropdownOpen(false)
    setAnnouncement('Fit to page')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't capture when typing in the page input
    if ((e.target as HTMLElement).tagName === 'INPUT') return

    switch (e.key) {
      case 'PageDown':
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        goToPage(currentPage + 1)
        break
      case 'PageUp':
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        goToPage(currentPage - 1)
        break
      case 'Home':
        e.preventDefault()
        goToPage(1)
        break
      case 'End':
        e.preventDefault()
        goToPage(totalPages)
        break
      case '+':
      case '=':
        e.preventDefault()
        zoomIn()
        break
      case '-':
        e.preventDefault()
        zoomOut()
        break
      case '0':
        e.preventDefault()
        setScale(1)
        setZoomMode('custom')
        setAnnouncement('Zoom 100%')
        break
      case 'Escape':
        if (zoomDropdownOpen) {
          e.preventDefault()
          setZoomDropdownOpen(false)
        }
        break
    }
  }

  const rotateClockwise = () => {
    setRotation(r => (r + 90) % 360)
    setAnnouncement('Rotated clockwise')
  }

  const toggleThumbnails = () => {
    setThumbnailsOpen(prev => !prev)
  }

  const toggleOutline = () => {
    setOutlineOpen(prev => !prev)
  }

  const toggleScrollMode = () => {
    setScrollMode(prev => (prev === 'single' ? 'continuous' : 'single'))
  }

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Sync fullscreen state with browser events and adjust zoom mode
  useEffect(() => {
    const handleChange = () => {
      const active = !!document.fullscreenElement
      setIsFullscreen(active)
      if (active) {
        setZoomMode('fit-width')
      } else {
        setZoomMode('custom')
        setScale(1)
      }
      setAnnouncement(active ? 'Entered fullscreen' : 'Exited fullscreen')
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev
      try {
        localStorage.setItem('pdf-dark-mode', String(next))
      } catch {
        // silent-catch-ok: localStorage fallback is non-critical
        // localStorage unavailable
      }
      setAnnouncement(next ? 'Dark mode on' : 'Dark mode off')
      return next
    })
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value)
  }

  const commitPageInput = () => {
    const val = parseInt(pageInputValue, 10)
    if (!isNaN(val)) {
      goToPage(val)
    } else {
      setPageInputValue(String(currentPage))
    }
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitPageInput()
      ;(e.target as HTMLInputElement).blur()
    }
  }

  const displayZoom = () => {
    if (zoomMode === 'fit-width') return 'Width'
    if (zoomMode === 'fit-page') return 'Page'
    const closest = ZOOM_PRESETS.reduce((prev, curr) =>
      Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev
    )
    return ZOOM_LABELS[closest] || `${Math.round(scale * 100)}%`
  }

  return {
    // State
    totalPages,
    currentPage,
    scale,
    zoomMode,
    isLoading,
    loadError,
    announcement,
    zoomDropdownOpen,
    pageInputValue,
    rotation,
    darkMode,
    isFullscreen,
    thumbnailsOpen,
    outlineOpen,
    pdfDocument,
    scrollMode,
    pageWidth,
    pageHeight,

    // Refs
    containerRef,
    contentRef,
    dropdownRef,

    // Actions
    goToPage,
    handleDocumentLoadSuccess,
    handleDocumentLoadError,
    handlePageLoadSuccess,
    zoomIn,
    zoomOut,
    setZoomPreset,
    fitWidth,
    fitPage,
    handleKeyDown,
    handlePageInputChange,
    handlePageInputKeyDown,
    commitPageInput,
    displayZoom,
    setZoomDropdownOpen,
    rotateClockwise,
    toggleDarkMode,
    toggleFullscreen,
    toggleThumbnails,
    toggleOutline,
    toggleScrollMode,
    setThumbnailsOpen,
    setOutlineOpen,
  }
}
