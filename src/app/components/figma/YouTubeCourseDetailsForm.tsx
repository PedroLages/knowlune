/**
 * YouTube Course Details Form (Step 4)
 *
 * Final step of the YouTube import wizard. Lets the user finalize
 * course metadata (name, description, tags, thumbnail) before saving
 * to Dexie as an ImportedCourse + ImportedVideo records.
 *
 * Story: E28-S08
 * @see useYouTubeImportStore.ts — saveCourse() action
 * @see YouTubeImportDialog.tsx — wizard host
 */

import { useState, useCallback, useMemo } from 'react'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { Badge } from '@/app/components/ui/badge'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import {
  Image as ImageIcon,
  X,
  Plus,
  Check,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import type { YouTubeImportVideo } from '@/stores/useYouTubeImportStore'
import type { VideoChapter } from '@/lib/youtubeRuleBasedGrouping'

// --- Types ---

export interface CourseDetailsFormData {
  name: string
  description: string
  tags: string[]
  selectedThumbnailVideoId: string | null
}

interface YouTubeCourseDetailsFormProps {
  /** Pre-filled course name (from playlist title or first video) */
  initialName: string
  /** Pre-filled description */
  initialDescription: string
  /** Videos available for thumbnail selection */
  videos: YouTubeImportVideo[]
  /** Chapter structure from step 3 */
  chapters: VideoChapter[]
  /** Callback when form data changes */
  onChange: (data: CourseDetailsFormData) => void
  /** Current form data */
  formData: CourseDetailsFormData
}

// --- Component ---

export function YouTubeCourseDetailsForm({
  videos,
  onChange,
  formData,
}: YouTubeCourseDetailsFormProps) {
  const [tagInput, setTagInput] = useState('')

  // Name validation — inline error within 200ms (NFR25)
  const nameError = useMemo(() => {
    if (!formData.name.trim()) return 'Course name is required'
    return null
  }, [formData.name])

  const handleNameChange = useCallback(
    (value: string) => {
      onChange({ ...formData, name: value })
    },
    [onChange, formData]
  )

  const handleDescriptionChange = useCallback(
    (value: string) => {
      onChange({ ...formData, description: value })
    },
    [onChange, formData]
  )

  const handleAddTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim().toLowerCase()
      if (!normalized || formData.tags.includes(normalized)) return
      onChange({ ...formData, tags: [...formData.tags, normalized] })
      setTagInput('')
    },
    [onChange, formData]
  )

  const handleRemoveTag = useCallback(
    (tag: string) => {
      onChange({ ...formData, tags: formData.tags.filter(t => t !== tag) })
    },
    [onChange, formData]
  )

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddTag(tagInput)
      } else if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0) {
        // Remove last tag when backspace on empty input
        handleRemoveTag(formData.tags[formData.tags.length - 1])
      }
    },
    [tagInput, handleAddTag, handleRemoveTag, formData.tags]
  )

  const handleThumbnailSelect = useCallback(
    (videoId: string) => {
      onChange({
        ...formData,
        selectedThumbnailVideoId:
          formData.selectedThumbnailVideoId === videoId ? null : videoId,
      })
    },
    [onChange, formData]
  )

  // Videos with thumbnails for selection
  const thumbnailVideos = useMemo(
    () => videos.filter(v => v.metadata?.thumbnailUrl && v.status === 'loaded'),
    [videos]
  )

  return (
    <div className="space-y-5" data-testid="course-details-form">
      {/* Course Name */}
      <div className="space-y-1.5">
        <label
          htmlFor="course-name"
          className="text-sm font-medium text-foreground"
        >
          Course Name <span className="text-destructive">*</span>
        </label>
        <Input
          id="course-name"
          value={formData.name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Enter course name"
          className={nameError ? 'border-destructive focus-visible:ring-destructive' : ''}
          data-testid="course-name-input"
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'course-name-error' : undefined}
          autoFocus
        />
        {nameError && (
          <p
            id="course-name-error"
            className="text-xs text-destructive"
            role="alert"
            data-testid="course-name-error"
          >
            {nameError}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label
          htmlFor="course-description"
          className="text-sm font-medium text-foreground"
        >
          Description
        </label>
        <Textarea
          id="course-description"
          value={formData.description}
          onChange={e => handleDescriptionChange(e.target.value)}
          placeholder="Enter course description (optional)"
          className="min-h-[80px] resize-none"
          data-testid="course-description-input"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label
          htmlFor="course-tags"
          className="text-sm font-medium text-foreground"
        >
          Tags
        </label>
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-input bg-background px-3 py-2 min-h-[44px] focus-within:ring-2 focus-within:ring-ring">
          {formData.tags.map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          <input
            id="course-tags"
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={formData.tags.length === 0 ? 'Type and press Enter to add tags' : 'Add tag...'}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            data-testid="course-tags-input"
          />
          {tagInput.trim() && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-7 p-0 shrink-0"
              onClick={() => handleAddTag(tagInput)}
              aria-label="Add tag"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Thumbnail Selection */}
      {thumbnailVideos.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Cover Image
          </label>
          <p className="text-xs text-muted-foreground">
            Select a video thumbnail as the course cover image.
          </p>
          <ScrollArea className="max-h-[160px]">
            <div
              className="grid grid-cols-4 gap-2 pr-2"
              role="radiogroup"
              aria-label="Select course cover image"
            >
              {thumbnailVideos.slice(0, 8).map(video => {
                const isSelected = formData.selectedThumbnailVideoId === video.videoId
                return (
                  <button
                    key={video.videoId}
                    type="button"
                    onClick={() => handleThumbnailSelect(video.videoId)}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? 'border-brand ring-2 ring-brand/30'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Use thumbnail from ${video.metadata?.title || video.videoId}`}
                    data-testid={`thumbnail-${video.videoId}`}
                  >
                    <img
                      src={video.metadata!.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                        <Check className="size-5 text-brand-foreground drop-shadow-md" aria-hidden="true" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {thumbnailVideos.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface-sunken/50 p-4">
          <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            No video thumbnails available for cover image selection.
          </p>
        </div>
      )}
    </div>
  )
}
