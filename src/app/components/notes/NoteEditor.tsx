import { useEffect, useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Typography from '@tiptap/extension-typography'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Image from '@tiptap/extension-image'
import { FileHandler } from '@tiptap/extension-file-handler'
import Youtube from '@tiptap/extension-youtube'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import { common, createLowlight } from 'lowlight'
import { toast } from 'sonner'
import { CodeBlockView } from './CodeBlockView'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  List,
  ListOrdered,
  ListTodo,
  Code,
  Heading2,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  Clock,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Input } from '@/app/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { cn } from '@/app/components/ui/utils'

const lowlight = createLowlight(common)

const IMAGE_MAX_SIZE = 5 * 1024 * 1024 // 5MB

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

/** Convert a File to a base64 data URL */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Validate a YouTube URL and return true if valid */
function isValidYoutubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url)
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
  const [wordCount, setWordCount] = useState(0)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)
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

  const handleImageFiles = useCallback(
    async (files: File[], editor: ReturnType<typeof useEditor> extends infer E ? NonNullable<E> : never) => {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        if (file.size > IMAGE_MAX_SIZE) {
          toast.warning(`Image "${file.name}" exceeds 5 MB limit`)
          continue
        }
        const src = await fileToBase64(file)
        editor.chain().focus().setImage({ src }).run()
      }
    },
    [],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          protocols: ['video'],
          HTMLAttributes: { class: 'text-brand underline cursor-pointer' },
        },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder:
          'Write your notes for this lesson\u2026 Use the toolbar to format, or click Add Timestamp to link to a video moment.',
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      CharacterCount,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CodeBlockLowlight.configure({ lowlight }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView)
        },
      }),
      Image.configure({ allowBase64: true }),
      FileHandler.configure({
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        onDrop: (editor, files) => handleImageFiles(files, editor),
        onPaste: (editor, files) => handleImageFiles(files, editor),
      }),
      Youtube.configure({ nocookie: true }),
      Details,
      DetailsContent,
      DetailsSummary,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[250px] outline-none px-5 py-4',
        'aria-label': 'Lesson notes',
        'aria-multiline': 'true',
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
    onCreate: ({ editor: ed }) => {
      setWordCount(ed.storage.characterCount.words())
    },
    onUpdate: ({ editor: ed }) => {
      setWordCount(ed.storage.characterCount.words())
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

  const openLinkDialog = useCallback(() => {
    if (!editor) return

    // Pre-fill with existing link URL or selected text if it looks like a URL
    const existingHref = editor.getAttributes('link').href
    if (existingHref) {
      setLinkUrl(existingHref)
    } else {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to)
      if (/^https?:\/\//.test(selectedText)) {
        setLinkUrl(selectedText)
      } else {
        setLinkUrl('')
      }
    }
    setLinkDialogOpen(true)
  }, [editor])

  const handleInsertLink = useCallback(() => {
    if (!editor || !linkUrl.trim()) return

    const url = linkUrl.trim()
    if (!/^(https?:\/\/|\/|video:\/\/)/.test(url)) return

    editor.chain().focus().setLink({ href: url }).run()
    setLinkDialogOpen(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  const handleRemoveLink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().unsetLink().run()
    setLinkDialogOpen(false)
    setLinkUrl('')
  }, [editor])

  const handleInsertYoutube = useCallback(() => {
    if (!editor || !youtubeUrl.trim()) return

    const url = youtubeUrl.trim()
    if (!isValidYoutubeUrl(url)) return

    editor.chain().focus().setYoutubeVideo({ src: url }).run()
    setYoutubeDialogOpen(false)
    setYoutubeUrl('')
  }, [editor, youtubeUrl])

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor || !e.target.files?.length) return
    await handleImageFiles(Array.from(e.target.files), editor)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }, [editor, handleImageFiles])

  if (!editor) return null

  return (
    <div
      data-testid="note-editor"
      className={cn('bg-card rounded-[24px] shadow-sm overflow-hidden', className)}
    >
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        data-testid="note-editor-toolbar"
        className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/30 flex-wrap"
      >
        {/* Inline formatting group */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          aria-label="Bold"
        >
          <Bold className="size-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          aria-label="Italic"
        >
          <Italic className="size-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          aria-label="Underline"
        >
          <UnderlineIcon className="size-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive('highlight')}
          aria-label="Highlight"
        >
          <Highlighter className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" decorative={false} className="h-6 mx-1" />

        {/* Block formatting group — hidden on mobile, in overflow menu */}
        <div className="hidden sm:flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            aria-label="Heading"
          >
            <Heading2 className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            aria-label="Align left"
          >
            <AlignLeft className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            aria-label="Align center"
          >
            <AlignCenter className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
            aria-label="Align right"
          >
            <AlignRight className="size-4" />
          </ToolbarButton>

          <Separator orientation="vertical" decorative={false} className="h-6 mx-1" />
        </div>

        {/* List group */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          aria-label="Bullet list"
        >
          <List className="size-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          aria-label="Ordered list"
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          aria-label="Task list"
        >
          <ListTodo className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" decorative={false} className="h-6 mx-1" />

        {/* Code & media group */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          aria-label="Code block"
        >
          <Code className="size-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => imageInputRef.current?.click()}
          aria-label="Insert image"
        >
          <ImageIcon className="size-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => { setYoutubeUrl(''); setYoutubeDialogOpen(true) }}
          aria-label="YouTube embed"
        >
          <YoutubeIcon className="size-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setDetails().run()}
          aria-label="Toggle block"
        >
          <ChevronRight className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" decorative={false} className="h-6 mx-1" />

        {/* Link */}
        <ToolbarButton
          onClick={openLinkDialog}
          active={editor.isActive('link')}
          aria-label="Insert link"
        >
          <Link2 className="size-4" />
        </ToolbarButton>

        {/* Mobile overflow menu */}
        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center justify-center size-11 rounded-md text-sm transition-colors cursor-pointer',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                )}
                aria-label="More formatting options"
              >
                <ChevronDown className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                <Heading2 className="size-4 mr-2" />
                Heading
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <AlignLeft className="size-4 mr-2" />
                  Alignment
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  >
                    <AlignLeft className="size-4 mr-2" />
                    Left
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  >
                    <AlignCenter className="size-4 mr-2" />
                    Center
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  >
                    <AlignRight className="size-4 mr-2" />
                    Right
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                onClick={() => imageInputRef.current?.click()}
              >
                <ImageIcon className="size-4 mr-2" />
                Image
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setYoutubeUrl(''); setYoutubeDialogOpen(true) }}
              >
                <YoutubeIcon className="size-4 mr-2" />
                YouTube
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().setDetails().run()}
              >
                <ChevronRight className="size-4 mr-2" />
                Toggle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Timestamp button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={insertTimestamp}
          className="h-11 px-3 text-xs ml-auto"
          aria-label="Add Timestamp"
        >
          <Clock className="size-3.5 mr-1.5" />
          Add Timestamp
        </Button>
      </div>

      {/* Hidden file input for image uploads */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Status bar */}
      <div className="flex items-center justify-between px-5 py-2 border-t border-border text-xs text-muted-foreground">
        <span data-testid="note-word-count">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        <div
          data-testid="note-autosave-indicator"
          hidden={saveStatus !== 'saved'}
          aria-live="polite"
        >
          {saveStatus === 'saved' ? 'Saved' : ''}
        </div>
      </div>

      {/* Link dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Enter the URL for this link.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleInsertLink()
              }
            }}
          />
          <DialogFooter>
            {editor.isActive('link') && (
              <Button variant="destructive" size="sm" onClick={handleRemoveLink}>
                Remove Link
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleInsertLink}
              disabled={!linkUrl.trim() || !/^(https?:\/\/|\/|video:\/\/)/.test(linkUrl.trim())}
            >
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* YouTube dialog */}
      <Dialog open={youtubeDialogOpen} onOpenChange={setYoutubeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Embed YouTube Video</DialogTitle>
            <DialogDescription>
              Paste a YouTube video URL to embed it in your notes.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleInsertYoutube()
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setYoutubeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleInsertYoutube}
              disabled={!youtubeUrl.trim() || !isValidYoutubeUrl(youtubeUrl.trim())}
            >
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center size-11 rounded-md text-sm transition-colors cursor-pointer',
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
