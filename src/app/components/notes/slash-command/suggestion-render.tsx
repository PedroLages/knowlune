import { createRoot, type Root } from 'react-dom/client'
import type { SuggestionOptions, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { SlashCommandList, type SlashCommandItem, type SlashCommandListRef } from './SlashCommandList'

/**
 * Creates a Tiptap suggestion `render()` config that mounts a SlashCommandList
 * via React DOM and positions it using the suggestion's clientRect.
 */
export function createSlashCommandRender(): SuggestionOptions<SlashCommandItem>['render'] {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let listRef: SlashCommandListRef | null = null

  return () => ({
    onStart(props) {
      container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.zIndex = '50'
      document.body.appendChild(container)

      root = createRoot(container)
      root.render(
        <SlashCommandList
          ref={(ref) => { listRef = ref }}
          items={props.items}
          command={props.command}
        />,
      )

      updatePosition(container, props.clientRect)
    },

    onUpdate(props) {
      root?.render(
        <SlashCommandList
          ref={(ref) => { listRef = ref }}
          items={props.items}
          command={props.command}
        />,
      )

      updatePosition(container, props.clientRect)
    },

    onKeyDown(props: SuggestionKeyDownProps) {
      if (props.event.key === 'Escape') {
        destroy()
        return true
      }
      return listRef?.onKeyDown(props) ?? false
    },

    onExit() {
      destroy()
    },
  })

  function destroy() {
    root?.unmount()
    container?.remove()
    root = null
    container = null
    listRef = null
  }

  function updatePosition(
    el: HTMLDivElement | null,
    clientRect: (() => DOMRect | null) | undefined,
  ) {
    if (!el || !clientRect) return
    const rect = clientRect()
    if (!rect) return

    el.style.left = `${rect.left + window.scrollX}px`
    el.style.top = `${rect.bottom + window.scrollY + 4}px`
  }
}
