import { ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { cn } from '@/app/components/ui/utils'

interface CollapsibleCardSectionProps {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

/**
 * Collapsible card section with a consistent header pattern:
 * a clickable title with a chevron icon (rotates when open).
 * Used in the ControlCenter sidebar for focus session and AI ordering sections.
 */
export function CollapsibleCardSection({
  title,
  open,
  onOpenChange,
  children,
}: CollapsibleCardSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer select-none">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {title}
              </h3>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform duration-200',
                  open && 'rotate-180'
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  )
}
