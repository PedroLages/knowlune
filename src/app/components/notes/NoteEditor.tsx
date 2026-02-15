import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Clock } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Textarea } from '@/app/components/ui/textarea'
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
 * Extract hashtags from markdown content
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
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer font-medium"
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
  currentVideoTime = 0,
  onSave,
  onVideoSeek,
  className,
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [extractedTags, setExtractedTags] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Update content when initialContent changes (e.g., lesson navigation)
  useEffect(() => {
    setContent(initialContent)
    setExtractedTags(extractTags(initialContent))
  }, [initialContent, courseId, lessonId])

  // Debounced autosave (3 seconds)
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      const tags = extractTags(content)
      setExtractedTags(tags)
      onSave?.(content, tags)
    }, 3000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, onSave])

  // Force save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      const tags = extractTags(content)
      onSave?.(content, tags)
    }
  }, [content, onSave])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
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

  return (
    <div className={cn('bg-card rounded-2xl shadow-sm', className)}>
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
                <Clock className="h-3.5 w-3.5 mr-1.5" />
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
            placeholder="Write your notes for this lesson... Use **bold**, *italic*, `code`, # for tags, and click 'Add Timestamp' to link to video moments."
            className="min-h-[300px] resize-y font-mono text-sm"
            aria-label="Lesson notes editor"
          />

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {extractedTags.length > 0 && (
                <div className="flex items-center gap-2">
                  <span>Tags:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedTags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
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

          {extractedTags.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedTags.map(tag => (
                    <span
                      key={tag}
                      className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
