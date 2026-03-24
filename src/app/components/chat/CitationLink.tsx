/**
 * Citation Link Component
 *
 * Renders clickable citation badges that navigate to source notes.
 */

import { useNavigate } from 'react-router'
import type { CitationMetadata } from '@/ai/rag/types'

interface CitationLinkProps {
  /** Citation index (1-based) */
  index: number
  /** Citation metadata */
  citation: CitationMetadata
}

/**
 * Clickable citation badge that navigates to source note
 *
 * Displays as [1], [2], etc. with hover tooltip showing note title.
 * Clicking navigates to /notes page with video and note ID in URL.
 */
export function CitationLink({ index, citation }: CitationLinkProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    // Navigate to notes page with video ID and scroll to note
    navigate(`/notes?video=${citation.videoId}#note-${citation.noteId}`)
  }

  return (
    <button
      type="button"
      data-citation={index}
      onClick={handleClick}
      className="inline-flex items-center justify-center size-6 ml-0.5 text-xs font-medium
                 bg-accent text-accent-foreground rounded hover:bg-accent-hover
                 focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
      title={`${citation.videoFilename} — ${citation.courseName}`}
      aria-label={`Citation ${index}: ${citation.videoFilename} from ${citation.courseName}`}
    >
      [{index}]
    </button>
  )
}
