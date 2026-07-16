import type { LucideIcon } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import type { StudyTool } from '@/app/hooks/useLessonSessionState'

export interface StudyToolOption {
  value: StudyTool
  label: string
  icon: LucideIcon
}

interface StudyToolSelectorProps {
  value: StudyTool
  tools: StudyToolOption[]
  onValueChange: (value: string) => void
}

/** Compact mobile replacement for the study-tool tab row. */
export function StudyToolSelector({ value, tools, onValueChange }: StudyToolSelectorProps) {
  return (
    <div className="sm:hidden">
      <label htmlFor="study-tool-selector" className="mb-2 block text-sm font-medium">
        Study Tool
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="study-tool-selector" className="h-11 rounded-xl" aria-label="Study tool">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {tools.map(tool => {
            const Icon = tool.icon
            return (
              <SelectItem key={tool.value} value={tool.value} className="min-h-11">
                <Icon className="size-4" aria-hidden="true" />
                {tool.label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
