import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { shouldReduceMotion } from '@/lib/settings'

export interface SearchReplaceOptions {
  searchClass: string
  activeClass: string
}

export interface SearchReplaceStorage {
  searchTerm: string
  replaceTerm: string
  results: { from: number; to: number }[]
  currentIndex: number
}

const searchReplacePluginKey = new PluginKey('searchReplace')

/** Respects app-level motion setting for programmatic scrolling. */
export function getScrollBehavior(): ScrollBehavior {
  return shouldReduceMotion() ? 'instant' : 'smooth'
}

function findMatches(
  doc: {
    textContent: string
    descendants: (cb: (node: { isText: boolean; text?: string }, pos: number) => void) => void
  },
  searchTerm: string
): { from: number; to: number }[] {
  if (!searchTerm) return []

  const results: { from: number; to: number }[] = []
  const term = searchTerm.toLowerCase()

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.toLowerCase()
    let index = text.indexOf(term)
    while (index !== -1) {
      results.push({ from: pos + index, to: pos + index + searchTerm.length })
      index = text.indexOf(term, index + 1)
    }
  })

  return results
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (term: string) => ReturnType
      setReplaceTerm: (term: string) => ReturnType
      findNext: () => ReturnType
      findPrev: () => ReturnType
      replaceCurrent: () => ReturnType
      replaceAll: () => ReturnType
      clearSearch: () => ReturnType
    }
  }
}

export const SearchReplace = Extension.create<SearchReplaceOptions, SearchReplaceStorage>({
  name: 'searchReplace',

  addOptions() {
    return {
      searchClass: 'search-match',
      activeClass: 'search-match-active',
    }
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      results: [],
      currentIndex: 0,
    }
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ editor }) => {
          this.storage.searchTerm = term
          this.storage.results = findMatches(editor.state.doc, term)
          this.storage.currentIndex = this.storage.results.length > 0 ? 0 : -1
          // Force decoration update by dispatching an empty transaction
          editor.view.dispatch(editor.state.tr)
          return true
        },

      setReplaceTerm: (term: string) => () => {
        this.storage.replaceTerm = term
        return true
      },

      findNext:
        () =>
        ({ editor }) => {
          const { results, currentIndex } = this.storage
          if (results.length === 0) return false
          this.storage.currentIndex = (currentIndex + 1) % results.length
          editor.view.dispatch(editor.state.tr)
          scrollToMatch(editor, this.storage.results[this.storage.currentIndex])
          return true
        },

      findPrev:
        () =>
        ({ editor }) => {
          const { results, currentIndex } = this.storage
          if (results.length === 0) return false
          this.storage.currentIndex = (currentIndex - 1 + results.length) % results.length
          editor.view.dispatch(editor.state.tr)
          scrollToMatch(editor, this.storage.results[this.storage.currentIndex])
          return true
        },

      replaceCurrent:
        () =>
        ({ editor, chain }) => {
          const { results, currentIndex, replaceTerm } = this.storage
          if (results.length === 0 || currentIndex < 0) return false
          const match = results[currentIndex]
          chain().insertContentAt({ from: match.from, to: match.to }, replaceTerm).run()
          // Re-search after replacement
          this.storage.results = findMatches(editor.state.doc, this.storage.searchTerm)
          if (this.storage.currentIndex >= this.storage.results.length) {
            this.storage.currentIndex = this.storage.results.length > 0 ? 0 : -1
          }
          editor.view.dispatch(editor.state.tr)
          return true
        },

      replaceAll:
        () =>
        ({ editor }) => {
          const { results, replaceTerm } = this.storage
          if (results.length === 0) return false
          // Replace from end to start to preserve positions
          const sorted = [...results].sort((a, b) => b.from - a.from)
          const tr = editor.state.tr
          for (const match of sorted) {
            tr.insertText(replaceTerm, match.from, match.to)
          }
          editor.view.dispatch(tr)
          // Re-search on updated doc, then dispatch to update decorations
          this.storage.results = findMatches(editor.state.doc, this.storage.searchTerm)
          this.storage.currentIndex = this.storage.results.length > 0 ? 0 : -1
          editor.view.dispatch(editor.state.tr)
          return true
        },

      clearSearch:
        () =>
        ({ editor }) => {
          this.storage.searchTerm = ''
          this.storage.replaceTerm = ''
          this.storage.results = []
          this.storage.currentIndex = -1
          editor.view.dispatch(editor.state.tr)
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    const { searchClass, activeClass } = this.options

    return [
      new Plugin({
        key: searchReplacePluginKey,
        props: {
          decorations: state => {
            const { results, currentIndex } = storage
            if (results.length === 0) return DecorationSet.empty

            const decorations = results.map((match, i) =>
              Decoration.inline(match.from, match.to, {
                class: i === currentIndex ? `${searchClass} ${activeClass}` : searchClass,
              })
            )

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        // This is handled in the NoteEditor component to toggle the panel
        // Return false to allow the event to bubble
        return false
      },
    }
  },
})

function scrollToMatch(
  editor: { view: { domAtPos: (pos: number) => { node: Node } } },
  match: { from: number; to: number } | undefined
) {
  if (!match) return
  const dom = editor.view.domAtPos(match.from)
  const el = dom.node instanceof Element ? dom.node : dom.node.parentElement
  el?.scrollIntoView({ block: 'center', behavior: getScrollBehavior() })
}
