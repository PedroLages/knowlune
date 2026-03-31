import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { toast } from 'sonner'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { getAvatarSrc, getInitials } from '@/lib/authors'
import { db } from '@/db'
import { VideoReorderDialog } from '@/app/components/course/VideoReorderDialog'
import type { ImportedCourse, ImportedVideo, YouTubeCourseChapter } from '@/data/types'

interface EditCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: ImportedCourse
  allTags: string[]
}

export function EditCourseDialog({ open, onOpenChange, course, allTags }: EditCourseDialogProps) {
  const updateCourseDetails = useCourseImportStore(state => state.updateCourseDetails)
  const authors = useAuthorStore(state => state.authors)
  const loadAuthors = useAuthorStore(state => state.loadAuthors)
  const linkCourseToAuthor = useAuthorStore(state => state.linkCourseToAuthor)
  const unlinkCourseFromAuthor = useAuthorStore(state => state.unlinkCourseFromAuthor)

  const [name, setName] = useState(course.name)
  const [description, setDescription] = useState(course.description ?? '')
  const [category, setCategory] = useState(course.category)
  const [tags, setTags] = useState<string[]>(course.tags)
  const [tagInput, setTagInput] = useState('')
  const [authorId, setAuthorId] = useState<string>(course.authorId ?? '')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [videos, setVideos] = useState<ImportedVideo[]>([])
  const [chapters, setChapters] = useState<YouTubeCourseChapter[]>([])

  const useChapterGrouping = course.source === 'youtube'

  useEffect(() => {
    loadAuthors()
  }, [loadAuthors])

  // Reset form when dialog opens with fresh course data
  useEffect(() => {
    if (open) {
      setName(course.name)
      setDescription(course.description ?? '')
      setCategory(course.category)
      setTags([...course.tags])
      setTagInput('')
      setAuthorId(course.authorId ?? '')
      setSaving(false)
      setActiveTab('details')

      // Load videos and chapters for reorder tab with cancellation guard
      let cancelled = false

      Promise.all([
        db.importedVideos.where('courseId').equals(course.id).sortBy('order'),
        // silent-catch-ok — youtubeChapters table may not exist for local courses
        db.youtubeChapters
          .where('courseId')
          .equals(course.id)
          .sortBy('order')
          .catch(() => [] as YouTubeCourseChapter[]),
      ])
        .then(([vids, chs]) => {
          if (!cancelled) {
            setVideos(vids)
            setChapters(chs)
          }
        })
        .catch(err => {
          // silent-catch-ok — non-critical: video tab will show empty state
          if (!cancelled) console.error('[EditCourseDialog] Failed to load videos:', err)
        })

      return () => {
        cancelled = true
      }
    }
  }, [open, course.id, course.name, course.description, course.category, course.tags])

  const nameValid = name.trim().length > 0
  const hasChanges =
    name.trim() !== course.name ||
    (description.trim() || '') !== (course.description ?? '') ||
    category.trim() !== course.category ||
    JSON.stringify([...tags].sort()) !== JSON.stringify([...course.tags].sort()) ||
    authorId !== (course.authorId ?? '')

  function handleRemoveTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag))
  }

  function handleAddTag() {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed])
    }
    setTagInput('')
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddTag()
    }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  // Tag suggestions: existing tags not already in the current list
  const suggestions = allTags.filter(
    t =>
      !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()) && tagInput.length > 0
  )

  async function handleSave() {
    if (!nameValid || saving) return
    setSaving(true)
    try {
      const newAuthorId = authorId || null
      const success = await updateCourseDetails(course.id, {
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        tags,
        authorId: newAuthorId,
      })
      if (!success) {
        toast.error('Failed to save changes')
      } else {
        // Sync author ↔ course bidirectional link
        const oldAuthorId = course.authorId ?? ''
        if (oldAuthorId !== (authorId || '')) {
          // Unlink from old author
          if (oldAuthorId) {
            await unlinkCourseFromAuthor(oldAuthorId, course.id)
          }
          // Link to new author
          if (authorId) {
            await linkCourseToAuthor(authorId, course.id)
          }
        }
        toast.success('Course updated')
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="edit-course-dialog"
        className="max-w-lg max-h-[85vh] flex flex-col rounded-[24px]"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
          <DialogDescription>Update course details or reorder videos.</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full" data-testid="edit-course-tabs">
            <TabsTrigger value="details" data-testid="tab-details" className="flex-1">
              Details
            </TabsTrigger>
            <TabsTrigger value="videos" data-testid="tab-videos" className="flex-1">
              Video Order
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-4">
              {/* Course Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-course-name">Course Name</Label>
                <Input
                  id="edit-course-name"
                  data-testid="edit-course-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Course name"
                  aria-invalid={!nameValid && name !== course.name}
                  maxLength={120}
                />
                {!nameValid && (
                  <p className="text-xs text-destructive" aria-live="polite">
                    Course name is required.
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-course-description">Description</Label>
                <Textarea
                  id="edit-course-description"
                  data-testid="edit-course-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="edit-course-category">Category</Label>
                <Input
                  id="edit-course-category"
                  data-testid="edit-course-category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Programming, Design"
                  maxLength={60}
                />
              </div>

              {/* Author */}
              <div className="space-y-2">
                <Label htmlFor="edit-course-author">Author</Label>
                <Select
                  value={authorId || '__none__'}
                  onValueChange={v => setAuthorId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger
                    id="edit-course-author"
                    data-testid="edit-course-author"
                    className="w-full"
                  >
                    <SelectValue placeholder="Select an author" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Unknown Author</span>
                    </SelectItem>
                    {authors.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2">
                          <Avatar className="size-5 inline-flex">
                            <AvatarImage {...getAvatarSrc(a.photoUrl ?? '', 20)} alt="" />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(a.name)}
                            </AvatarFallback>
                          </Avatar>
                          {a.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="edit-course-tags">Tags</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map(tag => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      data-testid="edit-tag-badge"
                      className="gap-1 pr-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove tag: ${tag}`}
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="relative">
                  <Input
                    id="edit-course-tags"
                    data-testid="edit-course-tag-input"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={handleAddTag}
                    placeholder="Type a tag and press Enter..."
                    maxLength={40}
                  />
                  {suggestions.length > 0 && (
                    <div
                      data-testid="tag-suggestions"
                      role="listbox"
                      aria-label="Tag suggestions"
                      className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-1 shadow-md max-h-32 overflow-y-auto"
                    >
                      {suggestions.slice(0, 5).map(tag => (
                        <button
                          key={tag}
                          type="button"
                          role="option"
                          aria-selected={false}
                          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setTags(prev => [...prev, tag])
                            setTagInput('')
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="videos" className="mt-4 overflow-y-auto flex-1 min-h-0">
            <p className="mb-3 text-xs text-muted-foreground">
              Drag videos to change the lesson order. Changes are saved automatically.
            </p>
            <div className="overflow-y-auto">
              <VideoReorderDialog
                videos={videos}
                chapters={chapters}
                useChapterGrouping={useChapterGrouping}
                onReorder={setVideos}
              />
            </div>
          </TabsContent>
        </Tabs>

        {activeTab === 'details' && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="edit-course-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={handleSave}
              disabled={!nameValid || !hasChanges || saving}
              data-testid="edit-course-save"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        )}

        {activeTab === 'videos' && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="edit-course-done"
            >
              Done
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
