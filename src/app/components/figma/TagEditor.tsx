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
  const canCreate =
    trimmed.length > 0 && !allTags.includes(trimmed) && !currentTags.includes(trimmed)

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
          className="group inline-flex items-center justify-center rounded-full p-3 -m-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <span className="flex items-center justify-center rounded-full size-5 bg-secondary text-secondary-foreground group-hover:bg-secondary/80 transition-colors">
            <Plus className="size-3" />
          </span>
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
            onKeyDown={e => {
              if (e.key === ',') {
                e.preventDefault()
                if (trimmed && !currentTags.includes(trimmed)) {
                  onAddTag(trimmed)
                  setInputValue('')
                  setOpen(false)
                }
              }
            }}
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
