import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

/** Read-only TipTap renderer for displaying note content without editing. */
export function ReadOnlyContent({ content }: { content: string }) {
  const editor = useEditor({
    editable: false,
    content,
    extensions: [StarterKit],
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none' },
    },
  })
  return <EditorContent editor={editor} />
}
