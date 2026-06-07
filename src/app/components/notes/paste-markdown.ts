import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * Conservative heuristic: returns true when the pasted plain text
 * contains clear block-level Markdown markers.
 *
 * False positives are worse than false negatives — we'd rather skip
 * a genuine Markdown paste than mangle ordinary prose that happens
 * to contain a hyphen or period.
 */
function looksLikeMarkdown(text: string): boolean {
  if (!text || text.trim().length === 0) return false

  // Block-level markers (any line starting with these):
  // - headings: # through ######
  // - unordered lists: - * +
  // - ordered lists: 1. 2. etc.
  // - fenced code blocks: ```
  // - blockquotes: >
  const blockMarker = /(^|\n)(#{1,6}\s|[*-]\s|\d+\.\s|```|>)/m
  if (blockMarker.test(text)) return true

  // Inline markers: require at least two distinct patterns to avoid
  // false positives from a single `*` or `_` in normal prose.
  const inlinePatterns: RegExp[] = [
    /\*\*[^*]+\*\*/,             // **bold**
    /__[^_]+__/,                 // __bold__
    /\*[^*]+\*/,                 // *italic*
    /_[^_]+_/,                   // _italic_
    /`[^`]+`/,                   // `code`
    /\[.*\]\(.*\)/,              // [link](url)
    /!\[.*\]\(.*\)/,             // ![image](url)
  ]

  let inlineMatches = 0
  for (const pattern of inlinePatterns) {
    if (pattern.test(text)) inlineMatches++
    if (inlineMatches >= 2) return true
  }

  return false
}

const pasteMarkdownPluginKey = new PluginKey('pasteMarkdown')

/**
 * TipTap extension that intercepts plain-text paste events and converts
 * Markdown text to rich content via the registered Markdown extension's
 * parser (`editor.markdown.parse`).
 *
 * Requires the `@tiptap/markdown` extension to be registered in the editor.
 * Non-Markdown and rich-HTML pastes pass through unchanged.
 */
export const PasteMarkdown = Extension.create({
  name: 'pasteMarkdown',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        key: pasteMarkdownPluginKey,
        props: {
          handlePaste(_view, event) {
            // Only intercept plain-text pastes — rich HTML pastes
            // (e.g., copy from another editor) keep default behavior.
            const text = event.clipboardData?.getData('text/plain')
            if (!text) return false

            if (!looksLikeMarkdown(text)) return false

            // Guard: Markdown extension must be registered
            if (!editor.markdown) return false

            try {
              const json = editor.markdown.parse(text)
              editor.commands.insertContent(json)
              return true
            } catch {
              // silent-catch-ok: fall through to default paste behavior
              // so the user still gets their text (as plain text).
              return false
            }
          },
        },
      }),
    ]
  },
})
