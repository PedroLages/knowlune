import { useState, useRef, useEffect } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface SearchMatch {
  pageNumber: number
  index: number
  length: number
}

export interface PdfSearchState {
  searchOpen: boolean
  searchQuery: string
  matches: SearchMatch[]
  activeMatchIndex: number
  isExtracting: boolean
  getHighlightsForPage: (
    pageNumber: number
  ) => Array<{ start: number; end: number; active: boolean }>
  makeTextRenderer: (
    pageNumber: number
  ) => ((item: { str: string; itemIndex: number }) => string) | undefined
}

export interface PdfSearchActions {
  openSearch: () => void
  closeSearch: () => void
  setSearchQuery: (query: string) => void
  nextMatch: () => void
  prevMatch: () => void
}

export function usePdfSearch(
  pdfDocument: PDFDocumentProxy | null,
  goToPage: (page: number) => void
): PdfSearchState & PdfSearchActions {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQueryState] = useState('')
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const [isExtracting, setIsExtracting] = useState(false)

  const pageTextsRef = useRef<string[]>([])
  const pageItemOffsetsRef = useRef<number[][]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const extractionCancelledRef = useRef(false)

  // Extract text from all pages when pdfDocument changes
  useEffect(() => {
    if (!pdfDocument) {
      pageTextsRef.current = []
      return
    }

    extractionCancelledRef.current = false
    setIsExtracting(true)

    const extract = async () => {
      const texts: string[] = []
      const allOffsets: number[][] = []

      for (let i = 1; i <= pdfDocument.numPages; i++) {
        if (extractionCancelledRef.current) return

        const page = await pdfDocument.getPage(i)
        const content = await page.getTextContent()
        let cumOffset = 0
        const offsets: number[] = []
        const parts: string[] = []
        for (const item of content.items) {
          const str = 'str' in item ? item.str : ''
          offsets.push(cumOffset)
          parts.push(str)
          cumOffset += str.length
        }
        texts.push(parts.join(''))
        allOffsets.push(offsets)
      }

      if (!extractionCancelledRef.current) {
        pageTextsRef.current = texts
        pageItemOffsetsRef.current = allOffsets
        setIsExtracting(false)
      }
    }

    extract().catch(() => {
      if (!extractionCancelledRef.current) {
        setIsExtracting(false)
      }
    })

    return () => {
      extractionCancelledRef.current = true
    }
  }, [pdfDocument])

  // Perform search when query changes (debounced)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!searchQuery.trim()) {
      setMatches([])
      setActiveMatchIndex(0)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      const results: SearchMatch[] = []
      const query = searchQuery.toLowerCase()
      const texts = pageTextsRef.current

      for (let pageIdx = 0; pageIdx < texts.length; pageIdx++) {
        const pageText = texts[pageIdx].toLowerCase()
        let startIndex = 0

        while (startIndex < pageText.length) {
          const foundIndex = pageText.indexOf(query, startIndex)
          if (foundIndex === -1) break

          results.push({
            pageNumber: pageIdx + 1,
            index: foundIndex,
            length: query.length,
          })

          startIndex = foundIndex + 1
        }
      }

      setMatches(results)
      setActiveMatchIndex(0)

      // Navigate to the first match's page
      if (results.length > 0) {
        goToPage(results[0].pageNumber)
      }
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery, goToPage])

  const openSearch = () => {
    setSearchOpen(true)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQueryState('')
    setMatches([])
    setActiveMatchIndex(0)
  }

  const setSearchQuery = (query: string) => {
    setSearchQueryState(query)
  }

  const nextMatch = () => {
    if (matches.length === 0) return

    const nextIndex = (activeMatchIndex + 1) % matches.length
    setActiveMatchIndex(nextIndex)
    goToPage(matches[nextIndex].pageNumber)
  }

  const prevMatch = () => {
    if (matches.length === 0) return

    const prevIndex =
      (activeMatchIndex - 1 + matches.length) % matches.length
    setActiveMatchIndex(prevIndex)
    goToPage(matches[prevIndex].pageNumber)
  }

  const getHighlightsForPage = (pageNumber: number): Array<{ start: number; end: number; active: boolean }> => {
    return matches
      .map((match, idx) => ({ match, idx }))
      .filter(({ match }) => match.pageNumber === pageNumber)
      .map(({ match, idx }) => ({
        start: match.index,
        end: match.index + match.length,
        active: idx === activeMatchIndex,
      }))
  }

  const makeTextRenderer = (pageNumber: number): ((item: { str: string; itemIndex: number }) => string) | undefined => {
    if (!searchQuery.trim() || matches.length === 0) return undefined

    const highlights = getHighlightsForPage(pageNumber)
    if (highlights.length === 0) return undefined

    const offsets = pageItemOffsetsRef.current[pageNumber - 1]
    if (!offsets) return undefined

    return ({ str, itemIndex }: { str: string; itemIndex: number }) => {
      const itemStart = offsets[itemIndex] ?? 0
      const itemEnd = itemStart + str.length

      const overlapping = highlights.filter(h => h.start < itemEnd && h.end > itemStart)
      if (overlapping.length === 0) return str

      let result = ''
      let pos = 0
      for (const h of overlapping) {
        const hStart = Math.max(h.start - itemStart, 0)
        const hEnd = Math.min(h.end - itemStart, str.length)
        if (hStart > pos) {
          result += str.slice(pos, hStart)
        }
        const cls = h.active ? 'bg-orange-400 rounded' : 'bg-yellow-300/70 rounded'
        result += `<mark class="${cls}">${str.slice(hStart, hEnd)}</mark>`
        pos = hEnd
      }
      result += str.slice(pos)
      return result
    }
  }

  return {
    searchOpen,
    searchQuery,
    matches,
    activeMatchIndex,
    isExtracting,
    getHighlightsForPage,
    makeTextRenderer,
    openSearch,
    closeSearch,
    setSearchQuery,
    nextMatch,
    prevMatch,
  }
}
