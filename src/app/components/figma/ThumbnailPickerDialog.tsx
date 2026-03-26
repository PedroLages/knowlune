import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, Link, Sparkles, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { cn } from '@/app/components/ui/utils'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import {
  extractThumbnailFromVideo,
  loadThumbnailFromFile,
  fetchThumbnailFromUrl,
  generateThumbnailWithGemini,
} from '@/lib/thumbnailService'
import { getAIConfiguration, getDecryptedApiKey } from '@/lib/aiConfiguration'
import type { ThumbnailSource } from '@/data/types'
import type { ImportedVideo } from '@/data/types'

interface ThumbnailPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  courseName: string
  firstVideo: ImportedVideo | null
}

type TabId = 'auto' | 'local' | 'url' | 'ai'

export function ThumbnailPickerDialog({
  open,
  onOpenChange,
  courseId,
  courseName,
  firstVideo,
}: ThumbnailPickerDialogProps) {
  const updateCourseThumbnail = useCourseImportStore(state => state.updateCourseThumbnail)

  const [activeTab, setActiveTab] = useState<TabId>('auto')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [pendingSource, setPendingSource] = useState<ThumbnailSource>('auto')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [aiPrompt, setAiPrompt] = useState(courseName)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const aiConfig = getAIConfiguration()
  const geminiConfigured = aiConfig.provider === 'gemini'

  function resetState() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPendingBlob(null)
    setError(null)
    setIsLoading(false)
  }

  function handleTabChange(tab: string) {
    resetState()
    setActiveTab(tab as TabId)
  }

  function handleClose(open: boolean) {
    if (!open) resetState()
    onOpenChange(open)
  }

  async function applyBlob(blob: Blob, source: ThumbnailSource) {
    const url = URL.createObjectURL(blob)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(url)
    setPendingBlob(blob)
    setPendingSource(source)
    setError(null)
  }

  // --- Auto tab ---
  async function handleAutoExtract() {
    if (!firstVideo?.fileHandle) {
      setError('No video found in this course to extract a thumbnail from.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const blob = await extractThumbnailFromVideo(firstVideo.fileHandle)
      await applyBlob(blob, 'auto')
    } catch (err) {
      // silent-catch-ok: error state updated in component
      setError(err instanceof Error ? err.message : 'Failed to extract thumbnail.')
    } finally {
      setIsLoading(false)
    }
  }

  // --- Local tab ---
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsLoading(true)
    setError(null)
    try {
      const blob = await loadThumbnailFromFile(file)
      await applyBlob(blob, 'local')
    } catch (err) {
      // silent-catch-ok: error state updated in component
      setError(err instanceof Error ? err.message : 'Failed to load image.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      setError('Please drop an image file.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const blob = await loadThumbnailFromFile(file)
      await applyBlob(blob, 'local')
    } catch (err) {
      // silent-catch-ok: error state updated in component
      setError(err instanceof Error ? err.message : 'Failed to load image.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // --- URL tab ---
  async function handleFetchUrl() {
    const url = urlInput.trim()
    if (!url) return
    setIsLoading(true)
    setError(null)
    try {
      const blob = await fetchThumbnailFromUrl(url)
      await applyBlob(blob, 'url')
    } catch (err) {
      // silent-catch-ok: error state updated in component
      setError(err instanceof Error ? err.message : 'Failed to fetch image from URL.')
    } finally {
      setIsLoading(false)
    }
  }

  // --- AI tab ---
  async function handleGenerate() {
    const prompt = aiPrompt.trim() || courseName
    setIsLoading(true)
    setError(null)
    try {
      const apiKey = await getDecryptedApiKey()
      if (!apiKey) {
        setError('No API key found. Configure Gemini in Settings → AI Configuration.')
        return
      }
      const blob = await generateThumbnailWithGemini(prompt, apiKey)
      await applyBlob(blob, 'ai')
    } catch (err) {
      // silent-catch-ok: error state updated in component
      setError(err instanceof Error ? err.message : 'AI generation failed.')
    } finally {
      setIsLoading(false)
    }
  }

  // --- Confirm ---
  async function handleConfirm() {
    if (!pendingBlob) return
    await updateCourseThumbnail(courseId, pendingBlob, pendingSource)
    onOpenChange(false)
    resetState()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg rounded-[24px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-4" aria-hidden="true" />
            Change Thumbnail
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0">
            <TabsTrigger
              value="auto"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent py-2.5 text-xs gap-1.5"
            >
              <Camera className="size-3.5" aria-hidden="true" />
              Auto
            </TabsTrigger>
            <TabsTrigger
              value="local"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent py-2.5 text-xs gap-1.5"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              Upload
            </TabsTrigger>
            <TabsTrigger
              value="url"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent py-2.5 text-xs gap-1.5"
            >
              <Link className="size-3.5" aria-hidden="true" />
              URL
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent py-2.5 text-xs gap-1.5"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              AI Generate
            </TabsTrigger>
          </TabsList>

          <div className="px-6 py-5 space-y-4">
            {/* Preview */}
            {previewUrl && (
              <div className="relative rounded-xl overflow-hidden bg-muted aspect-video w-full">
                <img
                  src={previewUrl}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="size-5 text-success drop-shadow" aria-hidden="true" />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Tab content */}
            <TabsContent value="auto" className="mt-0">
              <p className="text-sm text-muted-foreground mb-3">
                Extract a frame from the first video in this course at the 10% mark.
              </p>
              <Button
                onClick={handleAutoExtract}
                disabled={isLoading || !firstVideo}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="size-4" aria-hidden="true" />
                )}
                {isLoading ? 'Extracting…' : 'Extract from first video'}
              </Button>
              {!firstVideo && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  No videos in this course.
                </p>
              )}
            </TabsContent>

            <TabsContent value="local" className="mt-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
                aria-label="Select image file"
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className={cn(
                  'border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer',
                  'hover:border-brand hover:bg-brand/5 transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-brand outline-none'
                )}
              >
                {isLoading ? (
                  <Loader2 className="size-8 mx-auto text-muted-foreground animate-spin mb-2" />
                ) : (
                  <Upload
                    className="size-8 mx-auto text-muted-foreground mb-2"
                    aria-hidden="true"
                  />
                )}
                <p className="text-sm font-medium">
                  {isLoading ? 'Loading…' : 'Click or drag an image here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP supported</p>
              </div>
            </TabsContent>

            <TabsContent value="url" className="mt-0 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="thumbnail-url">Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="thumbnail-url"
                    placeholder="https://example.com/image.jpg"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
                  />
                  <Button
                    onClick={handleFetchUrl}
                    disabled={isLoading || !urlInput.trim()}
                    className="shrink-0 gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Link className="size-4" aria-hidden="true" />
                    )}
                    Fetch
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Some websites block cross-origin requests. If this fails, download the image and use
                Upload instead.
              </p>
            </TabsContent>

            <TabsContent value="ai" className="mt-0 space-y-3">
              {geminiConfigured ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-prompt">Course description for AI</Label>
                    <Input
                      id="ai-prompt"
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder={courseName}
                    />
                  </div>
                  <Button onClick={handleGenerate} disabled={isLoading} className="w-full gap-2">
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="size-4" aria-hidden="true" />
                    )}
                    {isLoading ? 'Generating…' : 'Generate with Gemini'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Uses Google Gemini AI. Results may vary.
                  </p>
                </>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <Sparkles className="size-8 mx-auto text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Gemini API key required</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Switch to Google Gemini as your AI provider to use AI thumbnail generation.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <RouterLink to="/settings">Go to Settings</RouterLink>
                  </Button>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 pb-5">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!pendingBlob} className="gap-2">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Apply Thumbnail
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
