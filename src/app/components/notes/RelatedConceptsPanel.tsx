import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Link2, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { findRelatedNotes, type RelatedNote } from '@/lib/relatedConcepts'
import type { Note } from '@/data/types'

interface RelatedConceptsPanelProps {
  note: Note
  allNotes: Note[]
  courseNames: Map<string, string>
}

export function RelatedConceptsPanel({ note, allNotes, courseNames }: RelatedConceptsPanelProps) {
  const navigate = useNavigate()
  const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(true)
  const [isTagOnly, setIsTagOnly] = useState(false)

  const tagKey = useMemo(() => note.tags.join(','), [note.tags])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const results = await findRelatedNotes(note, allNotes, courseNames)
        if (cancelled) return
        setRelatedNotes(results)
        setIsTagOnly(results.length > 0 && results.every(r => r.tagOnly))
      } catch (err) {
        console.error('[RelatedConceptsPanel] Failed to find related notes:', err)
        if (!cancelled) setRelatedNotes([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [note.id, tagKey, allNotes.length])

  function handleNavigate(related: RelatedNote) {
    // Find the candidate note to determine navigation target
    const targetNote = allNotes.find(n => n.id === related.noteId)
    if (!targetNote) return

    // Navigate to the note in the Notes dashboard with a hash for scrolling
    navigate(`/notes#note-${related.noteId}`, {
      state: { fromNote: note.id },
    })
  }

  // Don't render if loading shows no results
  if (!isLoading && relatedNotes.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="mt-4 border-t pt-3" role="region" aria-label="Related concepts">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-brand transition-colors w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {isOpen ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            <Link2 className="size-3.5" aria-hidden="true" />
            Related Concepts
            {!isLoading && (
              <Badge variant="secondary" className="text-xs ml-1">
                {relatedNotes.length}
              </Badge>
            )}
            {isTagOnly && (
              <span className="text-xs text-muted-foreground/70 font-normal ml-1">
                (tag matches only)
              </span>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-1">
            {isLoading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (
              relatedNotes.map(related => (
                <button
                  key={related.noteId}
                  type="button"
                  onClick={() => handleNavigate(related)}
                  className={cn(
                    'flex flex-col gap-1 w-full text-left p-2 rounded-lg',
                    'hover:bg-accent transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                  aria-label={`Related note: ${related.title} from ${related.courseName}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate flex-1">{related.title}</span>
                    {related.similarityScore != null && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {Math.round(related.similarityScore * 100)}%
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {related.courseName}
                    </Badge>
                    {related.sharedTags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {related.sharedTerms.length >= 2 && (
                      <span className="text-xs text-muted-foreground">
                        terms: {related.sharedTerms.slice(0, 3).join(', ')}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
