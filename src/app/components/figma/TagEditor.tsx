import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/app/components/ui/command'

interface TagEditorProps {
  currentTags: string[]
  allTags: string[]
  onAddTag: (tag: string) => void
}

export function TagEditor({ currentTags, allTags, onAddTag }: TagEditorProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const suggestions = allTags.filter(
    tag => !currentTags.includes(tag) && tag.toLowerCase().includes(inputValue.toLowerCase())
  )

  const trimmed = inputValue.trim().toLowerCase()
  const canCreate = trimmed.length > 0 && !allTags.includes(trimmed) && !currentTags.includes(trimmed)

  function handleSelect(tag: string) {
    onAddTag(tag)
    setInputValue('')
    setOpen(false)
  }

  function handleCreate() {
    if (!canCreate) return
    onAddTag(trimmed)
    setInputValue('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="add-tag-button"
          aria-label="Add topic tag"
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center justify-center rounded-full h-5 w-5 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-testid="tag-editor-popover"
        className="w-56 p-0"
        align="start"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Add a tag..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {canCreate ? 'Press Enter or click below to create' : 'No tags available'}
            </CommandEmpty>
            {suggestions.length > 0 && (
              <CommandGroup heading="Suggestions">
                {suggestions.map(tag => (
                  <CommandItem key={tag} value={tag} onSelect={() => handleSelect(tag)}>
                    {tag}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {canCreate && (
              <CommandGroup>
                <CommandItem value={`create-${trimmed}`} onSelect={handleCreate}>
                  Create &ldquo;{trimmed}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
