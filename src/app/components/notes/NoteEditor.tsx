import { useEffect, useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading2,
  Link2,
  Clock,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'

interface NoteEditorProps {
  courseId: string
  lessonId: string
  initialContent?: string
  currentVideoTime?: number
  onSave?: (content: string, tags: string[]) => void
  onVideoSeek?: (seconds: number) => void
  className?: string
}

/**
 * Extract hashtags from text content
 * Matches #word or #word-with-dashes but not ##heading or #123
 */
function extractTags(content: string): string[] {
  const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9-]*)/g
  const tags = new Set<string>()
  let match

  while ((match = tagRegex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase())
  }

  return Array.from(tags)
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function NoteEditor({
  courseId,
  lessonId,
  initialContent = '',
  currentVideoTime = 0,
  onSave,
  onVideoSeek,
  className,
}: NoteEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const maxWaitRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastSavedContentRef = useRef(initialContent)

  // Latest-ref pattern to avoid stale closures
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  })
  const onVideoSeekRef = useRef(onVideoSeek)
  useEffect(() => {
    onVideoSeekRef.current = onVideoSeek
  })

  const doSave = useCallback((html: string) => {
    // Avoid duplicate saves of identical content
    if (html === lastSavedContentRef.current) return
    lastSavedContentRef.current = html

    const text = html.replace(/<[^>]*>/g, ' ')
    const tags = extractTags(text)
    onSaveRef.current?.(html, tags)

    // Show "Saved" indicator
    setSaveStatus('saved')
    clearTimeout(fadeTimeoutRef.current)
    fadeTimeoutRef.current = setTimeout(() => {
      setSaveStatus('idle')
    }, 2000)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          protocols: ['video'],
          HTMLAttributes: { class: 'text-brand underline cursor-pointer' },
        },
      }),
      Placeholder.configure({
        placeholder:
          'Write your notes for this lesson… Use the toolbar to format, or click Add Timestamp to link to a video moment.',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[250px] outline-none px-5 py-4',
      },
      handleClick: (_view, _pos, event) => {
        // Handle video:// link clicks
        const target = event.target as HTMLElement
        const anchor = target.closest('a')
        if (anchor) {
          const href = anchor.getAttribute('href')
          if (href?.startsWith('video://')) {
            event.preventDefault()
            const seconds = parseInt(href.replace('video://', ''), 10)
            if (!isNaN(seconds)) {
              onVideoSeekRef.current?.(seconds)
            }
            return true
          }
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()

      // Debounced save: 3 seconds after last keystroke
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        doSave(html)
        // Clear max-wait since we just saved
        clearTimeout(maxWaitRef.current)
        maxWaitRef.current = undefined
      }, 3000)

      // Max-wait: force save after 10 seconds of continuous typing
      if (!maxWaitRef.current) {
        maxWaitRef.current = setTimeout(() => {
          clearTimeout(saveTimeoutRef.current)
          doSave(ed.getHTML())
          maxWaitRef.current = undefined
        }, 10000)
      }
    },
  })

  // Keep a ref to the editor so unmount cleanup can read the latest instance
  const editorRef = useRef(editor)
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  // Update editor content when lesson changes
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      // Only update if the content is actually different (lesson navigation)
      const currentHtml = editor.getHTML()
      if (currentHtml !== initialContent) {
        editor.commands.setContent(initialContent || '')
        lastSavedContentRef.current = initialContent
        setSaveStatus('idle')
      }
    }
  }, [editor, initialContent, courseId, lessonId])

  // Force save on unmount
  useEffect(() => {
    return () => {
      clearTimeout(saveTimeoutRef.current)
      clearTimeout(maxWaitRef.current)
      clearTimeout(fadeTimeoutRef.current)
      const ed = editorRef.current
      if (ed && !ed.isDestroyed) {
        const html = ed.getHTML()
        if (html !== lastSavedContentRef.current) {
          const text = html.replace(/<[^>]*>/g, ' ')
          const tags = extractTags(text)
          onSaveRef.current?.(html, tags)
        }
      }
    }
  }, [])

  const insertTimestamp = useCallback(() => {
    if (!editor) return

    const timestamp = formatTimestamp(currentVideoTime)
    const seconds = Math.floor(currentVideoTime)

    editor
      .chain()
      .focus()
      .insertContent(
        `<a href="video://${seconds}">Jump to ${timestamp}</a> `
      )
      .run()
  }, [editor, currentVideoTime])

  const insertLink = useCallback(() => {
    if (!editor) return

    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  if (!editor) return null

  return (
    <div
      data-testid="note-editor"
      className={cn('bg-card rounded-[24px] shadow-sm overflow-hidden', className)}
    >
      {/* Toolbar */}
      <div
        data-testid="note-editor-toolbar"
        className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/30 flex-wrap"
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          aria-label="Heading"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          aria-label="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          aria-label="Code block"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={insertLink} aria-label="Insert link">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>

        <Button
          variant="ghost"
          size="sm"
          onClick={insertTimestamp}
          className="h-8 px-3 text-xs ml-auto"
          aria-label="Add Timestamp"
        >
          <Clock className="h-3.5 w-3.5 mr-1.5" />
          Add Timestamp
        </Button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Status bar */}
      <div className="flex items-center justify-end px-5 py-2 border-t border-border text-xs text-muted-foreground">
        <div
          data-testid="note-autosave-indicator"
          hidden={saveStatus !== 'saved'}
          aria-live="polite"
        >
          {saveStatus === 'saved' ? 'Saved' : ''}
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  children,
  ...props
}: {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center h-8 w-8 rounded-md text-sm transition-colors cursor-pointer',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        active && 'bg-accent text-accent-foreground'
      )}
      {...props}
    >
      {children}
    </button>
  )
}
