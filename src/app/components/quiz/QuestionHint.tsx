import { Lightbulb } from 'lucide-react'

interface QuestionHintProps {
  hint?: string
}

export function QuestionHint({ hint }: QuestionHintProps) {
  if (!hint?.trim()) return null

  return (
    <div
      role="note"
      aria-label="Question hint"
      className="mt-4 flex items-start gap-3 rounded-xl bg-muted p-4"
    >
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
      <div>
        <span className="text-sm font-bold block">Hint</span>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}
