/**
 * Type helpers for Tiptap/ProseMirror node view patterns.
 *
 * The Details extension wraps its parent's node view factory to intercept
 * `ignoreMutation` calls. ProseMirror's node view interface uses
 * `ViewMutationRecord` for mutations and returns objects conforming to the
 * `NodeView` interface. These re-exports give us properly-typed wrappers
 * without resorting to `any`.
 */

import type { NodeView as ProseMirrorNodeView, ViewMutationRecord } from '@tiptap/pm/view'
import type { NodeViewRendererProps } from '@tiptap/core'

/**
 * A ProseMirror NodeView instance with a guaranteed `dom` element.
 * Used when wrapping a parent extension's node view factory, where we
 * need to read `dom` and patch `ignoreMutation`.
 */
export interface PatchableNodeView extends ProseMirrorNodeView {
  dom: HTMLElement
  ignoreMutation?: (mutation: ViewMutationRecord) => boolean
}

export type { NodeViewRendererProps, ViewMutationRecord }
