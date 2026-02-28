import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Clock } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Textarea } from '@/app/components/ui/textarea'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { TagBadgeList } from '@/app/components/figma/TagBadgeList'
import { TagEditor } from '@/app/components/figma/TagEditor'

interface NoteEditorProps {
  courseId: string
  lessonId: string
  initialContent?: string
  initialTags?: string[]
  allTags?: string[]
  currentVideoTime?: number
  onSave?: (content: string, tags: string[]) => void
  onTagsChange?: (tags: string[]) => void
  onVideoSeek?: (seconds: number) => void
  className?: string
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

/**
 * Custom link component for ReactMarkdown that handles video:// links
 */
function createVideoLinkComponent(onVideoSeek?: (seconds: number) => void) {
  return function VideoLink({ href, children, ...props }: any) {
    // Handle video:// timestamp links
    if (href && href.startsWith('video://')) {
      const seconds = parseInt(href.replace('video://', ''), 10)

      if (!isNaN(seconds) && onVideoSeek) {
        return (
          <button
            onClick={e => {
              e.preventDefault()
              onVideoSeek(seconds)
            }}
            className="text-brand hover:text-brand-hover underline cursor-pointer font-medium"
            type="button"
          >
            {children}
          </button>
        )
      }
    }

    // Regular links
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  }
}

export function NoteEditor({
  courseId,
  lessonId,
  initialContent = '',
  initialTags = [],
  allTags = [],
  currentVideoTime = 0,
  onSave,
  onTagsChange,
  onVideoSeek,
  className,
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [tags, setTags] = useState<string[]>(initialTags)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Latest-ref pattern: keep stable refs to avoid stale closures in effects
  const contentRef = useRef(content)
  const tagsRef = useRef(tags)
  const onSaveRef = useRef(onSave)
  useEffect(() => { contentRef.current = content })
  useEffect(() => { tagsRef.current = tags })
  useEffect(() => { onSaveRef.current = onSave })

  // Update content and tags when lesson changes or async note load completes.
  // Use value-based key for initialTags to avoid reference-identity re-syncs
  // while still picking up async getNotes() results.
  const initialTagsKey = initialTags.join(',')
  useEffect(() => {
    setContent(initialContent)
    setTags(initialTags)
  }, [initialContent, initialTagsKey, courseId, lessonId])

  // Debounced autosave (3 seconds) — only depends on content
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      onSaveRef.current?.(content, tagsRef.current)
    }, 3000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content])

  // Force save on TRUE unmount only (empty deps = runs only once on mount/unmount)
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      onSaveRef.current?.(contentRef.current, tagsRef.current)
    }
  }, [])

  // Track whether a tag change came from user action (vs prop sync)
  const tagSavePendingRef = useRef(false)
  const onTagsChangeRef = useRef(onTagsChange)
  useEffect(() => { onTagsChangeRef.current = onTagsChange })

  // Immediate save effect: fires when tags change due to user action
  useEffect(() => {
    if (!tagSavePendingRef.current) return
    tagSavePendingRef.current = false
    // Cancel pending content debounce — we're saving everything now
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    onSaveRef.current?.(contentRef.current, tags)
    onTagsChangeRef.current?.(tags)
  }, [tags])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
  }, [])

  const handleAddTag = useCallback((tag: string) => {
    const normalized = tag.trim().toLowerCase()
    if (!normalized) return
    tagSavePendingRef.current = true
    setTags(prev => {
      if (prev.includes(normalized)) return prev
      return [...prev, normalized].sort()
    })
  }, [])

  const handleRemoveTag = useCallback((tag: string) => {
    tagSavePendingRef.current = true
    setTags(prev => prev.filter(t => t !== tag))
  }, [])

  const insertTimestamp = useCallback(() => {
    if (!textareaRef.current) return

    const timestamp = formatTimestamp(currentVideoTime)
    const timestampLink = `[Jump to ${timestamp}](video://${Math.floor(currentVideoTime)})`

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = content.substring(0, start)
    const textAfter = content.substring(end)

    const newContent = `${textBefore}${timestampLink}${textAfter}`
    setContent(newContent)

    // Move cursor after inserted timestamp
    setTimeout(() => {
      const newCursorPos = start + timestampLink.length
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }, [content, currentVideoTime])

  const characterCount = content.length

  const tagSection = (
    <div data-testid="note-tags" aria-live="polite" aria-label="Note tags" className="flex items-center gap-2 flex-wrap">
      <TagBadgeList tags={tags} onRemove={handleRemoveTag} />
      <TagEditor
        currentTags={tags}
        allTags={allTags}
        onAddTag={handleAddTag}
      />
    </div>
  )

  return (
    <div data-testid="note-editor" className={cn('bg-card rounded-[24px] shadow-sm', className)}>
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'edit' | 'preview')}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <h3 className="text-sm font-semibold">Your Notes</h3>
          <div className="flex items-center gap-3">
            {activeTab === 'edit' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={insertTimestamp}
                className="h-8 px-3 text-xs"
                disabled={currentVideoTime === 0}
                title={currentVideoTime === 0 ? 'No video playing' : 'Insert current timestamp'}
              >
                <Clock className="size-3.5 mr-1.5" />
                Add Timestamp
              </Button>
            )}
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="edit" className="p-5 mt-0">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            placeholder="Write your notes for this lesson... Use **bold**, *italic*, `code`, and click 'Add Timestamp' to link to video moments."
            className="min-h-[300px] resize-y font-mono text-sm"
            aria-label="Lesson notes editor"
          />

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div>{tagSection}</div>
            <div>
              {characterCount} character{characterCount !== 1 ? 's' : ''}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="p-5 mt-0">
          {content.trim() === '' ? (
            <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
              <p>No notes yet. Switch to Edit tab to start writing.</p>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none min-h-[300px]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: createVideoLinkComponent(onVideoSeek),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <TagBadgeList tags={tags} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
