/**
 * useTts — React hook for EPUB read-aloud TTS integration.
 *
 * Responsibilities:
 * - Extract visible page text from epub.js rendition iframe
 * - Manage TTS playback state (playing, paused, rate, chunk progress)
 * - Apply word-by-word highlighting via DOM manipulation in epub iframe
 * - Handle page transitions: pause on page turn, auto-advance on end
 * - Clean up TTS on unmount
 *
 * @module useTts
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import type { Rendition } from 'epubjs'
import { ttsService } from '@/services/TtsService'

/** CSS class name injected into epub iframe for the active word */
const TTS_HIGHLIGHT_CLASS = 'tts-active-word'

/** Injects TTS highlight styles into the epub iframe document */
function injectTtsStyles(doc: Document): void {
  if (doc.getElementById('tts-styles')) return
  const style = doc.createElement('style')
  style.id = 'tts-styles'
  style.textContent = `.${TTS_HIGHLIGHT_CLASS} { background: rgba(255, 200, 0, 0.5); border-radius: 2px; }`
  doc.head?.appendChild(style)
}

/** Removes the current TTS word highlight from the document */
function clearHighlight(doc: Document): void {
  const existing = doc.querySelector(`.${TTS_HIGHLIGHT_CLASS}`)
  if (existing) {
    const parent = existing.parentNode
    if (parent) {
      parent.replaceChild(doc.createTextNode(existing.textContent ?? ''), existing)
      parent.normalize()
    }
  }
}

/** Highlights a word at charIndex/charLength in the document's text */
function highlightWord(doc: Document, fullText: string, charIndex: number, charLength: number, chunkOffset: number): void {
  const absoluteIndex = chunkOffset + charIndex
  if (charLength <= 0 || absoluteIndex < 0) return

  clearHighlight(doc)
  injectTtsStyles(doc)

  // Walk text nodes to find the right character position
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  let consumed = 0
  let node: Text | null = null
  let nodeStart = 0

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text
    const nodeLength = textNode.length
    if (consumed + nodeLength > absoluteIndex) {
      node = textNode
      nodeStart = consumed
      break
    }
    consumed += nodeLength
  }

  if (!node) return

  try {
    const range = doc.createRange()
    const startOffset = absoluteIndex - nodeStart
    const endOffset = Math.min(startOffset + charLength, node.length)
    range.setStart(node, startOffset)
    range.setEnd(node, endOffset)

    const mark = doc.createElement('mark')
    mark.className = TTS_HIGHLIGHT_CLASS
    range.surroundContents(mark)

    // Scroll highlighted word into view within the iframe
    mark.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } catch {
    // silent-catch-ok: DOM range operations can fail if epub content changes mid-operation
  }
}

/** Extracts the visible text content from the current epub.js page */
function extractPageText(rendition: Rendition): string {
  try {
    const contents = rendition.getContents()
    if (!contents || contents.length === 0) return ''

    // getContents() returns an array of Content objects, one per iframe
    const texts: string[] = []
    for (const content of contents) {
      // Access the document via the 'document' property (epub.js internal)
      const doc = (content as unknown as { document?: Document }).document
      if (doc?.body) {
        texts.push(doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      }
    }
    return texts.join(' ')
  } catch {
    // silent-catch-ok: content access can fail if rendition is in transition
    return ''
  }
}

/** Returns the epub iframe document for DOM manipulation, or null if unavailable */
function getEpubDocument(rendition: Rendition): Document | null {
  try {
    const contents = rendition.getContents()
    if (!contents || contents.length === 0) return null
    return (contents[0] as unknown as { document?: Document }).document ?? null
  } catch {
    // silent-catch-ok: content access can fail if rendition is in transition
    return null
  }
}

export interface UseTtsReturn {
  isTtsAvailable: boolean
  isTtsPlaying: boolean
  isTtsPaused: boolean
  ttsRate: number
  ttsCurrentChunk: number
  ttsTotalChunks: number
  startTts: () => void
  pauseTts: () => void
  resumeTts: () => void
  stopTts: () => void
  setTtsRate: (rate: number) => void
  toggleTts: () => void
}

export function useTts(renditionRef: React.RefObject<Rendition | null>): UseTtsReturn {
  const [isTtsAvailable] = useState(() => ttsService.isTtsAvailable())
  const [isTtsPlaying, setIsTtsPlaying] = useState(false)
  const [isTtsPaused, setIsTtsPaused] = useState(false)
  const [ttsRate, setTtsRateState] = useState(1.0)
  const [ttsCurrentChunk, setTtsCurrentChunk] = useState(0)
  const [ttsTotalChunks, setTtsTotalChunks] = useState(0)
  const fullTextRef = useRef<string>('')

  /** Stop TTS and clear all highlighting */
  const stopTts = useCallback(() => {
    ttsService.stop()
    setIsTtsPlaying(false)
    setIsTtsPaused(false)
    setTtsCurrentChunk(0)
    setTtsTotalChunks(0)

    // Clear highlight from epub iframe
    if (renditionRef.current) {
      const doc = getEpubDocument(renditionRef.current)
      if (doc) clearHighlight(doc)
    }
  }, [renditionRef])

  /** Start TTS from the current visible page */
  const startTts = useCallback(() => {
    if (!isTtsAvailable || !renditionRef.current) return

    const text = extractPageText(renditionRef.current)
    if (!text) return
    fullTextRef.current = text

    setIsTtsPlaying(true)
    setIsTtsPaused(false)

    ttsService.speak(text, {
      rate: ttsRate,
      onChunkStart: (chunkIndex, total) => {
        setTtsCurrentChunk(chunkIndex + 1)
        setTtsTotalChunks(total)
      },
      onBoundary: (event, chunkOffset) => {
        if (renditionRef.current) {
          const doc = getEpubDocument(renditionRef.current)
          if (doc) {
            highlightWord(doc, fullTextRef.current, event.charIndex, event.charLength, chunkOffset)
          }
        }
      },
      onEnd: () => {
        // Auto-advance to next page when TTS finishes the visible content
        if (renditionRef.current && ttsService.active) {
          renditionRef.current
            .next()
            .then(() => {
              // Brief delay to let epub.js render the new page before extracting text
              setTimeout(() => {
                if (renditionRef.current) {
                  const newText = extractPageText(renditionRef.current)
                  if (newText) {
                    fullTextRef.current = newText
                    ttsService.speak(newText, {
                      rate: ttsRate,
                      onChunkStart: (chunkIndex, total) => {
                        setTtsCurrentChunk(chunkIndex + 1)
                        setTtsTotalChunks(total)
                      },
                      onBoundary: (event, chunkOffset) => {
                        if (renditionRef.current) {
                          const doc = getEpubDocument(renditionRef.current)
                          if (doc) {
                            highlightWord(doc, fullTextRef.current, event.charIndex, event.charLength, chunkOffset)
                          }
                        }
                      },
                      onEnd: () => {
                        // Stop at end of book (no more pages)
                        setIsTtsPlaying(false)
                        setIsTtsPaused(false)
                      },
                    })
                  } else {
                    // End of book
                    setIsTtsPlaying(false)
                    setIsTtsPaused(false)
                  }
                }
              }, 500)
            })
            .catch(() => {
              // silent-catch-ok: at last page, next() is a no-op
              setIsTtsPlaying(false)
              setIsTtsPaused(false)
            })
        } else {
          setIsTtsPlaying(false)
          setIsTtsPaused(false)
        }
      },
    })
  }, [isTtsAvailable, renditionRef, ttsRate])

  const pauseTts = useCallback(() => {
    ttsService.pause()
    setIsTtsPaused(true)
    setIsTtsPlaying(false)
  }, [])

  const resumeTts = useCallback(() => {
    ttsService.resume()
    setIsTtsPaused(false)
    setIsTtsPlaying(true)
  }, [])

  const toggleTts = useCallback(() => {
    if (!isTtsPlaying && !isTtsPaused) {
      startTts()
    } else if (isTtsPlaying) {
      pauseTts()
    } else {
      resumeTts()
    }
  }, [isTtsPlaying, isTtsPaused, startTts, pauseTts, resumeTts])

  const setTtsRate = useCallback((rate: number) => {
    setTtsRateState(rate)
    // Restart with new rate if currently playing
    if (isTtsPlaying || isTtsPaused) {
      ttsService.stop()
      setTimeout(() => startTts(), 50)
    }
  }, [isTtsPlaying, isTtsPaused, startTts])

  // Stop TTS on unmount
  useEffect(() => {
    return () => {
      ttsService.stop()
    }
  }, [])

  return {
    isTtsAvailable,
    isTtsPlaying,
    isTtsPaused,
    ttsRate,
    ttsCurrentChunk,
    ttsTotalChunks,
    startTts,
    pauseTts,
    resumeTts,
    stopTts,
    setTtsRate,
    toggleTts,
  }
}
