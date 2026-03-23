import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  Link2,
  Palette,
  Layers,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { cn } from '@/app/components/ui/utils'
import { InteractiveButton } from '@/app/components/ui/interactive-button'

const TEXT_COLORS = [
  { label: 'Default', value: null, swatch: 'bg-foreground' },
  { label: 'Red', value: '#dc2626', swatch: 'bg-red-600' },
  { label: 'Orange', value: '#ea580c', swatch: 'bg-orange-600' },
  { label: 'Yellow', value: '#ca8a04', swatch: 'bg-yellow-600' },
  { label: 'Green', value: '#16a34a', swatch: 'bg-green-600' },
  { label: 'Blue', value: '#2563eb', swatch: 'bg-blue-600' },
  { label: 'Purple', value: '#9333ea', swatch: 'bg-purple-600' },
  { label: 'Pink', value: '#db2777', swatch: 'bg-pink-600' },
]

interface BubbleMenuBarProps {
  editor: Editor
  onOpenLinkDialog: () => void
  onCreateFlashcard?: () => void
}

export function BubbleMenuBar({ editor, onOpenLinkDialog, onCreateFlashcard }: BubbleMenuBarProps) {
  return (
    <BubbleMenu editor={editor}>
      <div
        data-testid="bubble-menu"
        className="flex items-center gap-0.5 rounded-xl bg-popover shadow-lg border border-border px-1 py-1"
        role="toolbar"
        aria-label="Text formatting"
      >
        <BubbleButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          aria-label="Bold"
        >
          <Bold className="size-4" />
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          aria-label="Italic"
        >
          <Italic className="size-4" />
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          aria-label="Underline"
        >
          <UnderlineIcon className="size-4" />
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive('highlight')}
          aria-label="Highlight"
        >
          <Highlighter className="size-4" />
        </BubbleButton>

        <BubbleButton onClick={onOpenLinkDialog} active={editor.isActive('link')} aria-label="Link">
          <Link2 className="size-4" />
        </BubbleButton>

        {onCreateFlashcard && (
          <BubbleButton onClick={onCreateFlashcard} aria-label="Create Flashcard">
            <Layers className="size-4" />
          </BubbleButton>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center size-11 rounded-md text-sm transition-colors cursor-pointer',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
              )}
              aria-label="Color"
            >
              <Palette className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="center" side="top">
            <div className="grid grid-cols-4 gap-1">
              {TEXT_COLORS.map(color => (
                <button
                  key={color.label}
                  type="button"
                  onClick={() => {
                    if (color.value) {
                      editor.chain().focus().setColor(color.value).run()
                    } else {
                      editor.chain().focus().unsetColor().run()
                    }
                  }}
                  className={cn(
                    'size-8 rounded-full border border-border transition-transform cursor-pointer',
                    'hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring',
                    color.swatch
                  )}
                  aria-label={color.label}
                  title={color.label}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </BubbleMenu>
  )
}

function BubbleButton({
  onClick,
  active,
  children,
  ...props
}: {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <InteractiveButton
      variant="ghost"
      size="icon"
      type="button"
      onClick={onClick}
      active={active}
      {...props}
    >
      {children}
    </InteractiveButton>
  )
}
