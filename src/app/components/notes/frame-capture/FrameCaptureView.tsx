import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { getFrameThumbnailUrl, formatFrameTimestamp } from '@/lib/frame-capture'
import { ImageOff } from 'lucide-react'

type LoadStatus = 'loading' | 'loaded' | 'error'

export function FrameCaptureView({ node, editor }: NodeViewProps) {
  const { screenshotId, timestamp } = node.attrs as {
    screenshotId: string
    timestamp: number
  }

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    getFrameThumbnailUrl(screenshotId)
      .then(url => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url)
          return
        }
        if (url) {
          urlRef.current = url
          setThumbnailUrl(url)
          setStatus('loaded')
        } else {
          setStatus('error')
        }
      })
      .catch(error => {
        // silent-catch-ok — error state handled by component
        console.error('Failed to load frame thumbnail:', error)
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [screenshotId])

  const canSeek = !!editor.storage.frameCapture?.onSeek

  const handleTimestampClick = () => {
    editor.storage.frameCapture?.onSeek?.(timestamp)
  }

  const caption = formatFrameTimestamp(timestamp)

  return (
    <NodeViewWrapper>
      <figure
        data-testid="frame-capture"
        className="my-3 rounded-lg overflow-hidden border border-border bg-muted/30 inline-block max-w-[300px]"
      >
        {status === 'loaded' && thumbnailUrl ? (
          <img src={thumbnailUrl} alt={caption} className="w-full h-auto block" draggable={false} />
        ) : status === 'error' ? (
          <div className="w-[200px] h-[112px] bg-muted flex items-center justify-center text-muted-foreground">
            <ImageOff className="size-6 mr-2" />
            <span className="text-xs">Frame unavailable</span>
          </div>
        ) : (
          <div className="w-[200px] h-[112px] bg-muted animate-pulse" />
        )}
        <figcaption className="px-3 py-1.5">
          {canSeek ? (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-brand cursor-pointer transition-colors bg-transparent border-none p-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
              onClick={handleTimestampClick}
              aria-label={`Seek to ${caption}`}
            >
              {caption}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">{caption}</span>
          )}
        </figcaption>
      </figure>
    </NodeViewWrapper>
  )
}
