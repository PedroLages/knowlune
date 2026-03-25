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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { toast } from 'sonner'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { db } from '@/db'
import { VideoReorderList } from '@/app/components/figma/VideoReorderList'
import type { ImportedCourse, ImportedVideo } from '@/data/types'

interface EditCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: ImportedCourse
  allTags: string[]
}

export function EditCourseDialog({ open, onOpenChange, course, allTags }: EditCourseDialogProps) {
  const updateCourseDetails = useCourseImportStore(state => state.updateCourseDetails)

  const [name, setName] = useState(course.name)
  const [description, setDescription] = useState(course.description ?? '')
  const [category, setCategory] = useState(course.category)
  const [tags, setTags] = useState<string[]>(course.tags)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [videos, setVideos] = useState<ImportedVideo[]>([])

  // Reset form when dialog opens with fresh course data
  useEffect(() => {
    if (open) {
      setName(course.name)
      setDescription(course.description ?? '')
      setCategory(course.category)
      setTags([...course.tags])
      setTagInput('')
      setSaving(false)
      setActiveTab('details')

      // Load videos for reorder tab with cancellation guard
      let cancelled = false
      db.importedVideos
        .where('courseId')
        .equals(course.id)
        .sortBy('order')
        .then(result => {
          if (!cancelled) setVideos(result)
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
    JSON.stringify([...tags].sort()) !== JSON.stringify([...course.tags].sort())

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
      const success = await updateCourseDetails(course.id, {
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        tags,
      })
      if (!success) {
        toast.error('Failed to save changes')
      } else {
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
        className="max-w-lg rounded-[24px]"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
          <DialogDescription>Update course details or reorder videos.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full" data-testid="edit-course-tabs">
            <TabsTrigger value="details" data-testid="tab-details" className="flex-1">
              Details
            </TabsTrigger>
            <TabsTrigger value="videos" data-testid="tab-videos" className="flex-1">
              Video Order
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
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

          <TabsContent value="videos" className="mt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Drag videos to change the lesson order. Changes are saved automatically.
            </p>
            <div className="max-h-[360px] overflow-y-auto">
              <VideoReorderList videos={videos} onReorder={setVideos} />
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
