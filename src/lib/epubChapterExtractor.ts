/**
 * EPUB Chapter Extractor
 *
 * Extracts table of contents from an EPUB file using epub.js.
 * Returns chapter hrefs and labels for use with the chapter matching engine.
 *
 * @module epubChapterExtractor
 * @since E103-S01
 */

import ePub from 'epubjs'

/** Extracted EPUB TOC item */
export interface EpubTocItem {
  href: string // spine href, e.g., "OEBPS/chapter01.xhtml"
  label: string // displayed title, e.g., "Chapter 1"
}

/**
 * Extract chapter titles from an EPUB file's table of contents.
 * Returns an empty array if the EPUB has no TOC.
 */
export async function extractEpubChapters(fileArrayBuffer: ArrayBuffer): Promise<EpubTocItem[]> {
  const book = ePub(fileArrayBuffer)
  await book.ready

  const toc = book.navigation.toc
  if (!toc || toc.length === 0) return []

  return toc.map(item => ({
    href: item.href,
    label: item.label.trim(),
  }))
}
