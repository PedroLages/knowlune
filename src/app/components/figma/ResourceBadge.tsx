import { Video, FileText, Music, Image, FileCode } from 'lucide-react'
import type { ResourceType } from '@/data/types'

const config: Record<ResourceType, { icon: typeof Video; label: string; color: string }> = {
  video: {
    icon: Video,
    label: 'Video',
    color: 'bg-resource-video-bg text-resource-video',
  },
  pdf: {
    icon: FileText,
    label: 'PDF',
    color: 'bg-resource-pdf-bg text-resource-pdf',
  },
  audio: {
    icon: Music,
    label: 'Audio',
    color: 'bg-resource-audio-bg text-resource-audio',
  },
  image: {
    icon: Image,
    label: 'Image',
    color: 'bg-resource-image-bg text-resource-image',
  },
  markdown: {
    icon: FileCode,
    label: 'Notes',
    color: 'bg-resource-notes-bg text-resource-notes',
  },
}

interface ResourceBadgeProps {
  type: ResourceType
  count?: number
}

export function ResourceBadge({ type, count }: ResourceBadgeProps) {
  const { icon: Icon, label, color } = config[type]
  const text = count !== undefined ? `${count} ${label}${count !== 1 ? 's' : ''}` : label

  return (
    <span
      role="status"
      aria-label={text}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {text}
    </span>
  )
}
