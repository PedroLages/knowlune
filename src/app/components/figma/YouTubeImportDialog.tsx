/**
 * YouTube Import Dialog
 *
 * 4-step wizard for building courses from YouTube content.
 * Steps 1 & 2 implemented in E28-S05:
 *   Step 1: URL Input — paste YouTube video/playlist URLs
 *   Step 2: Metadata Preview — view thumbnails, titles, durations
 * Step 3 implemented in E28-S06:
 *   Step 3: Organize — rule-based chapter grouping + chapter editor
 * Step 4 placeholder:
 *   Step 4: Details — set course name, description, tags (E28-S08)
 *
 * @see E28-S05 — Import Wizard Steps 1 & 2
 * @see E28-S06 — Rule-Based Video Grouping & Chapter Editor
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Youtube,
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  ListVideo,
  Play,
} from 'lucide-react'
import {
  parseMultipleYouTubeUrls,
  type YouTubeUrlParseResult,
} from '@/lib/youtubeUrlParser'
import {
  getVideoMetadataBatch,
  getPlaylistItems,
} from '@/lib/youtubeApi'
import {
  useYouTubeImportStore,
  type YouTubeUrlEntry,
  type YouTubeImportVideo,
} from '@/stores/useYouTubeImportStore'
import { groupVideosByRules, type GroupingVideo } from '@/lib/youtubeRuleBasedGrouping'
import { YouTubeChapterEditor } from '@/app/components/figma/YouTubeChapterEditor'

// --- Constants ---

/** Debounce delay for URL parsing (ms) */
const PARSE_DEBOUNCE_MS = 500

/** Step labels for the wizard indicator */
const STEP_LABELS = [
  { step: 1, label: 'Paste URLs' },
  { step: 2, label: 'Preview' },
  { step: 3, label: 'Organize' },
  { step: 4, label: 'Details' },
] as const

// --- Helpers ---

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

// --- Props ---

interface YouTubeImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// --- Component ---

export function YouTubeImportDialog({ open, onOpenChange }: YouTubeImportDialogProps) {
  const store = useYouTubeImportStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchAbortRef = useRef(false)

  // Local state for playlist choice prompt
  const [playlistPrompt, setPlaylistPrompt] = useState<{
    parseResult: YouTubeUrlParseResult
    index: number
  } | null>(null)

  // Clean up on close
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        store.reset()
        setPlaylistPrompt(null)
        fetchAbortRef.current = true
        if (debounceRef.current) clearTimeout(debounceRef.current)
      } else {
        fetchAbortRef.current = false
      }
      store.setIsOpen(nextOpen)
      onOpenChange(nextOpen)
    },
    [onOpenChange, store]
  )

  // --- Step 1: URL Input with debounced parsing ---

  const handleUrlChange = useCallback(
    (value: string) => {
      store.setUrlInput(value)

      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (!value.trim()) {
        store.setParsedUrls([])
        store.setFeedback('', 'none')
        return
      }

      debounceRef.current = setTimeout(() => {
        const results = parseMultipleYouTubeUrls(value)
        const entries: YouTubeUrlEntry[] = results.map(r => ({ parseResult: r }))

        store.setParsedUrls(entries)

        // Generate feedback
        const valid = results.filter(r => r.valid)
        const invalid = results.filter(r => !r.valid)

        if (valid.length === 0 && invalid.length > 0) {
          store.setFeedback('Not a valid YouTube URL', 'error')
        } else if (valid.length > 0 && invalid.length > 0) {
          store.setFeedback(
            `${valid.length} ${valid.length === 1 ? 'video' : 'videos'} detected, ${invalid.length} invalid ${invalid.length === 1 ? 'URL' : 'URLs'} skipped`,
            'warning'
          )
        } else if (valid.length > 0) {
          // Check for playlists
          const playlists = valid.filter(r => r.type === 'playlist')
          const videosInPlaylist = valid.filter(r => r.type === 'video-in-playlist')
          const singleVideos = valid.filter(
            r => r.type === 'video' || r.type === 'short' || r.type === 'embed'
          )

          if (playlists.length === 1 && singleVideos.length === 0 && videosInPlaylist.length === 0) {
            store.setFeedback('Playlist detected', 'success')
          } else if (videosInPlaylist.length > 0) {
            // Show playlist choice prompt for the first video-in-playlist
            const first = videosInPlaylist[0]
            const idx = entries.findIndex(e => e.parseResult === first)
            setPlaylistPrompt({ parseResult: first, index: idx })
            store.setFeedback(
              `${valid.length} ${valid.length === 1 ? 'URL' : 'URLs'} detected`,
              'success'
            )
          } else {
            store.setFeedback(
              `${valid.length} ${valid.length === 1 ? 'video' : 'videos'} detected`,
              'success'
            )
          }
        }
      }, PARSE_DEBOUNCE_MS)
    },
    [store]
  )

  // Handle playlist choice for video-in-playlist URLs
  const handlePlaylistChoice = useCallback(
    (choice: 'full-playlist' | 'single-video') => {
      if (!playlistPrompt) return

      const updatedEntries = [...store.parsedUrls]
      updatedEntries[playlistPrompt.index] = {
        ...updatedEntries[playlistPrompt.index],
        playlistChoice: choice,
      }
      store.setParsedUrls(updatedEntries)
      setPlaylistPrompt(null)
    },
    [playlistPrompt, store]
  )

  // --- Step 1 → Step 2: Fetch metadata ---

  const handleNextToPreview = useCallback(async () => {
    const validEntries = store.parsedUrls.filter(e => e.parseResult.valid)
    if (validEntries.length === 0) return

    store.setCurrentStep(2)
    fetchAbortRef.current = false

    // Collect all video IDs to fetch
    const videoIds: string[] = []
    const playlistsToFetch: string[] = []

    for (const entry of validEntries) {
      const { type, videoId, playlistId } = entry.parseResult

      if (type === 'playlist' && playlistId) {
        playlistsToFetch.push(playlistId)
      } else if (type === 'video-in-playlist') {
        if (entry.playlistChoice === 'full-playlist' && playlistId) {
          playlistsToFetch.push(playlistId)
        } else if (videoId) {
          videoIds.push(videoId)
        }
      } else if (videoId) {
        videoIds.push(videoId)
      }
    }

    // Fetch playlist items first to get video IDs
    for (const plId of playlistsToFetch) {
      if (fetchAbortRef.current) return

      const result = await getPlaylistItems(plId)
      if (result.ok) {
        for (const item of result.data) {
          if (!videoIds.includes(item.videoId)) {
            videoIds.push(item.videoId)
          }
        }
      }
    }

    if (fetchAbortRef.current || videoIds.length === 0) return

    // Deduplicate
    const uniqueIds = [...new Set(videoIds)]
    store.setVideosForFetch(uniqueIds)

    // Fetch metadata in batches
    const batchResults = await getVideoMetadataBatch(uniqueIds)

    if (fetchAbortRef.current) return

    let fetchedCount = 0
    for (const [id, result] of batchResults) {
      if (fetchAbortRef.current) return

      if (result.ok) {
        store.updateVideoMetadata(id, {
          metadata: result.data,
          status: 'loaded',
        })
      } else if (result.code === 'NOT_FOUND') {
        store.updateVideoMetadata(id, {
          status: 'unavailable',
          error: result.error,
        })
      } else {
        store.updateVideoMetadata(id, {
          status: 'error',
          error: result.error,
        })
      }
      fetchedCount++
      store.updateFetchProgress(fetchedCount, uniqueIds.length)
    }

    store.setIsFetchingMetadata(false)
  }, [store])

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // --- Computed values ---
  const activeVideos = store.getActiveVideos()
  const unavailableCount = store.getUnavailableCount()
  const canProceed = store.canProceedFromStep1()
  const fetchProgress =
    store.metadataTotal > 0
      ? Math.round((store.metadataFetchedCount / store.metadataTotal) * 100)
      : 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-3xl"
        data-testid="youtube-import-dialog"
        aria-describedby="youtube-import-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="size-5 text-destructive" aria-hidden="true" />
            Build from YouTube
          </DialogTitle>
          <DialogDescription id="youtube-import-description">
            {store.currentStep === 1 && 'Paste YouTube video or playlist URLs to get started.'}
            {store.currentStep === 2 && 'Preview the detected videos before organizing your course.'}
            {store.currentStep === 3 && 'Organize videos into chapters.'}
            {store.currentStep === 4 && 'Set course details.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <StepIndicator currentStep={store.currentStep} />

        {/* Step 1: URL Input */}
        {store.currentStep === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label
                htmlFor="youtube-url-input"
                className="text-sm font-medium text-foreground"
              >
                YouTube URLs
              </label>
              <Textarea
                id="youtube-url-input"
                placeholder={'Paste YouTube video or playlist URLs here (one per line)\n\nhttps://youtube.com/watch?v=...\nhttps://youtube.com/playlist?list=...'}
                value={store.urlInput}
                onChange={e => handleUrlChange(e.target.value)}
                className={`min-h-[140px] resize-none font-mono text-sm ${
                  store.feedbackType === 'error'
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }`}
                data-testid="youtube-url-textarea"
                aria-describedby="url-feedback"
                autoFocus
              />
            </div>

            {/* Validation Feedback */}
            {store.feedbackMessage && (
              <p
                id="url-feedback"
                data-testid="url-feedback"
                className={`text-sm font-medium ${
                  store.feedbackType === 'success'
                    ? 'text-success'
                    : store.feedbackType === 'warning'
                      ? 'text-warning'
                      : store.feedbackType === 'error'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                }`}
              >
                {store.feedbackType === 'success' && (
                  <CheckCircle2
                    className="inline-block size-4 mr-1.5 align-text-bottom"
                    aria-hidden="true"
                  />
                )}
                {store.feedbackType === 'warning' && (
                  <AlertTriangle
                    className="inline-block size-4 mr-1.5 align-text-bottom"
                    aria-hidden="true"
                  />
                )}
                {store.feedbackMessage}
              </p>
            )}

            {/* Playlist Choice Prompt */}
            {playlistPrompt && (
              <div
                className="rounded-xl border border-brand-soft bg-brand-soft/20 p-4 space-y-3"
                data-testid="playlist-choice-prompt"
                role="alert"
              >
                <p className="text-sm text-foreground">
                  This video is part of a playlist.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="brand"
                    size="sm"
                    className="rounded-xl min-h-[44px]"
                    onClick={() => handlePlaylistChoice('full-playlist')}
                    data-testid="choice-full-playlist"
                  >
                    <ListVideo className="size-4 mr-1.5" aria-hidden="true" />
                    Import full playlist
                  </Button>
                  <Button
                    variant="brand-outline"
                    size="sm"
                    className="rounded-xl min-h-[44px]"
                    onClick={() => handlePlaylistChoice('single-video')}
                    data-testid="choice-single-video"
                  >
                    <Play className="size-4 mr-1.5" aria-hidden="true" />
                    Import this video only
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Metadata Preview */}
        {store.currentStep === 2 && (
          <div className="space-y-4 py-2">
            {/* Loading state with progress bar */}
            {store.isFetchingMetadata && (
              <div className="space-y-2">
                <Progress
                  value={fetchProgress}
                  className="h-2"
                  showLabel
                  labelFormat={() =>
                    `Fetching video info... ${store.metadataFetchedCount} of ${store.metadataTotal}`
                  }
                />
              </div>
            )}

            {/* Unavailable videos banner */}
            {unavailableCount > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm text-warning"
                role="alert"
                data-testid="unavailable-banner"
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                {unavailableCount} {unavailableCount === 1 ? 'video is' : 'videos are'} unavailable
                (private or deleted)
              </div>
            )}

            {/* Video list with scroll shadows */}
            <ScrollArea
              className="max-h-[50vh] [mask-image:linear-gradient(to_bottom,transparent_0,black_16px,black_calc(100%-16px),transparent_100%)]"
              data-testid="video-preview-list"
            >
              <div
                className="space-y-2 pr-3"
                role="list"
                aria-label="Video preview list"
              >
                {store.isFetchingMetadata && store.videos.filter(v => v.status === 'pending').length > 0
                  ? /* Skeleton placeholders */
                    store.videos
                      .filter(v => v.status === 'pending')
                      .map(v => (
                        <VideoRowSkeleton key={v.videoId} />
                      ))
                  : null}

                {activeVideos.map(video => (
                  <VideoPreviewRow
                    key={video.videoId}
                    video={video}
                    onRemove={() => store.removeVideo(video.videoId)}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Active video count */}
            {!store.isFetchingMetadata && activeVideos.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {activeVideos.length} {activeVideos.length === 1 ? 'video' : 'videos'} in import list
              </p>
            )}
          </div>
        )}

        {/* Step 3: Organize — Chapter Editor (E28-S06) */}
        {store.currentStep === 3 && (
          <div className="py-2">
            <YouTubeChapterEditor
              chapters={store.chapters}
              videos={activeVideos}
              onChaptersChange={store.setChapters}
              showAiBanner
            />
          </div>
        )}

        {/* Step 4: Future placeholder */}
        {store.currentStep === 4 && (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">Coming in a future update</p>
          </div>
        )}

        {/* Footer Navigation */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {store.currentStep > 1 && (
              <Button
                variant="outline"
                onClick={() => {
                  fetchAbortRef.current = true
                  store.setCurrentStep((store.currentStep - 1) as 1 | 2 | 3 | 4)
                }}
                className="rounded-xl min-h-[44px]"
                data-testid="wizard-back-btn"
              >
                <ChevronLeft className="size-4 mr-1" aria-hidden="true" />
                Back
              </Button>
            )}
          </div>
          <Button
            variant="brand"
            disabled={
              (store.currentStep === 1 && !canProceed) ||
              (store.currentStep === 2 && (store.isFetchingMetadata || activeVideos.length === 0))
            }
            onClick={() => {
              if (store.currentStep === 1) {
                handleNextToPreview()
              } else if (store.currentStep === 2) {
                // Run rule-based grouping when entering Step 3
                const groupingVideos: GroupingVideo[] = activeVideos
                  .filter(v => v.metadata && v.status === 'loaded')
                  .map(v => ({
                    videoId: v.videoId,
                    title: v.metadata!.title,
                    description: v.metadata!.description,
                    duration: v.metadata!.duration,
                  }))
                const chapters = groupVideosByRules(groupingVideos)
                store.setChapters(chapters)
                store.setCurrentStep(3)
              } else if (store.currentStep < 4) {
                store.setCurrentStep((store.currentStep + 1) as 2 | 3 | 4)
              }
            }}
            className="rounded-xl min-h-[44px]"
            data-testid="wizard-next-btn"
          >
            {store.currentStep === 1 && store.isFetchingMetadata ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" aria-hidden="true" />
                Loading...
              </>
            ) : (
              <>
                Next
                <ChevronRight className="size-4 ml-1" aria-hidden="true" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Sub-components ---

/** Step indicator showing wizard progress */
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav
      aria-label="Import wizard steps"
      className="flex items-center justify-center gap-1 py-2"
      data-testid="step-indicator"
    >
      {STEP_LABELS.map(({ step, label }, index) => {
        const isActive = step === currentStep
        const isCompleted = step < currentStep

        return (
          <div key={step} className="flex items-center">
            {index > 0 && (
              <ChevronRight
                className="size-3 text-muted-foreground mx-1"
                aria-hidden="true"
              />
            )}
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                isActive
                  ? 'bg-brand text-brand-foreground'
                  : isCompleted
                    ? 'bg-success/10 text-success'
                    : 'text-muted-foreground'
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              {step} {label}
            </span>
          </div>
        )
      })}
    </nav>
  )
}

/** Skeleton placeholder for a video row while metadata loads */
function VideoRowSkeleton() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-2"
      role="listitem"
      aria-label="Loading video"
    >
      {/* Thumbnail skeleton — 80px, 16:9 */}
      <Skeleton className="w-20 h-[45px] rounded-lg shrink-0" />
      {/* Text skeletons */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      {/* Duration skeleton */}
      <Skeleton className="h-5 w-12 rounded-full shrink-0" />
    </div>
  )
}

/** Single video preview row with metadata */
function VideoPreviewRow({
  video,
  onRemove,
}: {
  video: YouTubeImportVideo
  onRemove: () => void
}) {
  const isUnavailable = video.status === 'unavailable'
  const isLoading = video.status === 'loading' || video.status === 'pending'

  if (isLoading) {
    return <VideoRowSkeleton />
  }

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent ${
        isUnavailable ? 'opacity-50' : ''
      }`}
      role="listitem"
      data-testid={`video-row-${video.videoId}`}
      aria-label={
        video.metadata?.title
          ? `${video.metadata.title}${isUnavailable ? ' (unavailable)' : ''}`
          : video.videoId
      }
    >
      {/* Thumbnail — 80px, 16:9, rounded */}
      <div className="w-20 h-[45px] rounded-lg overflow-hidden bg-muted shrink-0">
        {video.metadata?.thumbnailUrl ? (
          <img
            src={video.metadata.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Youtube className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Title + channel */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium line-clamp-2 ${
            isUnavailable ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}
        >
          {isUnavailable && (
            <AlertTriangle
              className="inline-block size-3.5 mr-1 align-text-bottom text-warning"
              aria-hidden="true"
            />
          )}
          {video.metadata?.title || video.videoId}
        </p>
        {video.metadata?.channelTitle && (
          <p className="text-xs text-muted-foreground truncate">
            {video.metadata.channelTitle}
          </p>
        )}
        {video.status === 'error' && video.error && (
          <p className="text-xs text-destructive truncate">{video.error}</p>
        )}
      </div>

      {/* Duration badge */}
      {video.metadata && video.metadata.duration > 0 && (
        <Badge
          variant="secondary"
          className="shrink-0 tabular-nums text-xs"
        >
          {formatDuration(video.metadata.duration)}
        </Badge>
      )}

      {/* Remove button */}
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 size-8 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity min-h-[24px] min-w-[24px]"
        onClick={onRemove}
        aria-label={`Remove ${video.metadata?.title || video.videoId}`}
        data-testid={`remove-video-${video.videoId}`}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
