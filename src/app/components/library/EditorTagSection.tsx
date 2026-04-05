/**
 * Tag input with autocomplete and chip display for the book metadata editor.
 *
 * Extracted from BookMetadataEditor to reduce component size.
 *
 * @since E83-S05
 */

import type { RefObject } from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'

interface EditorTagSectionProps {
  tags: string[]
  tagInput: string
  showTagSuggestions: boolean
  tagSuggestions: string[]
  isSaving: boolean
  tagInputRef: RefObject<HTMLInputElement | null>
  onTagInputChange: (value: string) => void
  onTagKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus: () => void
  onBlur: () => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

export function EditorTagSection({
  tags,
  tagInput,
  showTagSuggestions,
  tagSuggestions,
  isSaving,
  tagInputRef,
  onTagInputChange,
  onTagKeyDown,
  onFocus,
  onBlur,
  onAddTag,
  onRemoveTag,
}: EditorTagSectionProps) {
  return (
    <div>
      <Label htmlFor="edit-book-tags">Tags</Label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(tag => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 pr-1"
            data-testid={`tag-chip-${tag}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemoveTag(tag)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
              aria-label={`Remove tag ${tag}`}
              data-testid={`remove-tag-${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          ref={tagInputRef}
          id="edit-book-tags"
          value={tagInput}
          onChange={e => onTagInputChange(e.target.value)}
          onKeyDown={onTagKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Type a tag and press Enter"
          disabled={isSaving}
          data-testid="edit-book-tag-input"
        />
        {showTagSuggestions && tagSuggestions.length > 0 && (
          <ul
            className="absolute z-50 mt-1 max-h-32 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
            data-testid="tag-suggestions"
          >
            {tagSuggestions.slice(0, 8).map(suggestion => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={e => {
                    e.preventDefault()
                    onAddTag(suggestion)
                    tagInputRef.current?.focus()
                  }}
                  data-testid={`tag-suggestion-${suggestion}`}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
