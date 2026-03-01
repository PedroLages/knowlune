import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { FrameCaptureView } from './FrameCaptureView'

export interface FrameCaptureAttributes {
  screenshotId: string
  timestamp: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    frameCapture: {
      insertFrameCapture: (attrs: FrameCaptureAttributes) => ReturnType
    }
  }
}

export const FrameCaptureExtension = Node.create({
  name: 'frameCapture',
  group: 'block',
  atom: true,
  draggable: true,

  addStorage() {
    return {
      onSeek: null as ((timestamp: number) => void) | null,
    }
  },

  addAttributes() {
    return {
      screenshotId: { default: null },
      timestamp: { default: 0 },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="frame-capture"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { 'data-type': 'frame-capture' }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FrameCaptureView)
  },

  addCommands() {
    return {
      insertFrameCapture:
        (attrs: FrameCaptureAttributes) =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name, attrs }).run()
        },
    }
  },
})
