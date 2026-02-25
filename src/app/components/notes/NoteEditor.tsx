import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
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
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { createLowlight } from 'lowlight'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import bash from 'highlight.js/lib/languages/bash'
import { toast } from 'sonner'
import { CodeBlockView } from './CodeBlockView'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { BubbleMenuBar } from './BubbleMenuBar'
import { SlashCommand, getSlashCommandItems } from './slash-command'
import { createSlashCommandRender } from './slash-command/suggestion-render'
import { Emoji, emojis as emojiData } from '@tiptap/extension-emoji'
import { createEmojiSuggestionRender } from './emoji-suggestion-render'
import { SearchReplace, FindReplacePanel } from './search-replace'
import { TableOfContents } from '@tiptap/extension-table-of-contents'
import { TableOfContentsPanel } from './TableOfContentsPanel'
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
  GripVertical,
  ListTree,
  Search,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover'
import { cn } from '@/app/components/ui/utils'
import { formatTimestamp } from '@/lib/format'

const lowlight = createLowlight({ javascript, typescript, python, css, xml, bash })

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
  return /^https?:\/\/([a-z]+\.)?youtube\.com\/(watch\?.*v=|embed\/|shorts\/|v\/)|^https?:\/\/youtu\.be\//.test(url)
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
  const [findReplaceOpen, setFindReplaceOpen] = useState(false)
  const [, setTocVersion] = useState(0)
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
      const validFiles = files.filter(file => {
        if (!file.type.startsWith('image/')) return false
        if (file.size > IMAGE_MAX_SIZE) {
          toast.warning(`Image "${file.name}" exceeds 5 MB limit`)
          return false
        }
        return true
      })

      const base64s = await Promise.all(validFiles.map(fileToBase64))
      for (const src of base64s) {
        editor.chain().focus().setImage({ src }).run()
      }
    },
    [],
  )

  // Stable suggestion popup renders (created once, mounted/unmounted by Tiptap)
  const slashCommandRender = useMemo(() => createSlashCommandRender(), [])
  const emojiSuggestionRender = useMemo(() => createEmojiSuggestionRender(), [])
  const slashCommandItems = useMemo(
    () => getSlashCommandItems({
      onImageUpload: () => imageInputRef.current?.click(),
      onYoutubeEmbed: () => { setYoutubeUrl(''); setYoutubeDialogOpen(true) },
    }),
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
      Youtube.configure({ nocookie: true, HTMLAttributes: { title: 'YouTube video' } }),
      Details.extend({
        addNodeView() {
          const parentFactory = this.parent?.()
          if (!parentFactory) return parentFactory as never
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (props: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const view = (parentFactory as any)(props)
            const origIgnoreMutation = view.ignoreMutation
            // Ignore ARIA attribute mutations on child elements to prevent ProseMirror re-renders
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            view.ignoreMutation = (mutation: any) => {
              if (mutation.type === 'attributes' && view.dom.contains(mutation.target)) {
                return true
              }
              return origIgnoreMutation?.call(view, mutation) ?? true
            }
            return view
          }
        },
      }),
      DetailsContent,
      DetailsSummary,
      TextStyle,
      Color,
      SlashCommand.configure({
        suggestion: {
          items: ({ query }) =>
            slashCommandItems.filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()),
            ),
          render: slashCommandRender,
        },
      }),
      Emoji.configure({
        emojis: emojiData,
        enableEmoticons: false,
        suggestion: {
          render: emojiSuggestionRender,
        },
      }),
      SearchReplace,
      TableOfContents.configure({
        onUpdate: () => setTocVersion((v) => v + 1),
      }),
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

  // Add ARIA attributes to details toggle buttons for accessibility
  useEffect(() => {
    if (!editor) return
    const editorDom = editor.view.dom
    const blockObservers = new Map<Element, MutationObserver>()

    function attachAriaToBlock(block: Element) {
      if (blockObservers.has(block)) return
      const btn = block.querySelector(':scope > button')
      if (!btn) return
      btn.setAttribute('aria-label', 'Toggle details')
      btn.setAttribute('aria-expanded', block.classList.contains('is-open') ? 'true' : 'false')

      const obs = new MutationObserver(() => {
        btn.setAttribute('aria-expanded', block.classList.contains('is-open') ? 'true' : 'false')
      })
      obs.observe(block, { attributes: true, attributeFilter: ['class'] })
      blockObservers.set(block, obs)
    }

    function scanForDetails() {
      editorDom.querySelectorAll('div[data-type="details"]').forEach(attachAriaToBlock)
    }

    // Scan on every transaction (fires after content model changes)
    const onTransaction = () => { scanForDetails() }
    editor.on('transaction', onTransaction)
    scanForDetails()

    return () => {
      editor.off('transaction', onTransaction)
      blockObservers.forEach(obs => obs.disconnect())
      blockObservers.clear()
    }
  }, [editor])

  // Cmd+F to toggle find/replace panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setFindReplaceOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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

        {/* Find/Replace */}
        <ToolbarButton
          onClick={() => setFindReplaceOpen((prev) => !prev)}
          active={findReplaceOpen}
          aria-label="Find and replace"
        >
          <Search className="size-4" />
        </ToolbarButton>

        {/* Table of Contents */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center size-11 rounded-md text-sm transition-colors cursor-pointer',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              )}
              aria-label="Table of contents"
            >
              <ListTree className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <TableOfContentsPanel editor={editor} />
          </PopoverContent>
        </Popover>

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

      {/* Find/Replace panel (between toolbar and editor) */}
      {findReplaceOpen && (
        <FindReplacePanel
          editor={editor}
          onClose={() => setFindReplaceOpen(false)}
        />
      )}

      {/* Hidden file input for image uploads */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Bubble Menu (appears on text selection) */}
      <BubbleMenuBar editor={editor} onOpenLinkDialog={openLinkDialog} />

      {/* Drag Handle (appears on block hover in left gutter) */}
      <DragHandle editor={editor} data-testid="drag-handle">
        <button
          type="button"
          className="flex items-center justify-center size-6 rounded cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
      </DragHandle>

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
              <Button variant="destructive" className="h-11" onClick={handleRemoveLink}>
                Remove Link
              </Button>
            )}
            <Button variant="outline" className="h-11" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="h-11"
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
            <Button variant="outline" className="h-11" onClick={() => setYoutubeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="h-11"
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
