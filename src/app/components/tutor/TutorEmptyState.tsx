/**
 * TutorEmptyState (E57-S01, extended E73-S01)
 *
 * Mode-aware welcome state for the tutor chat when no messages exist.
 * Renders mode-specific icon, heading, and tappable suggestion prompts.
 */

import {
  Sparkles,
  HelpCircle,
  BookOpen,
  Lightbulb,
  ClipboardCheck,
  Bug,
} from 'lucide-react'
import type { TutorMode } from '@/ai/tutor/types'
import type { LucideIcon } from 'lucide-react'

interface TutorEmptyStateProps {
  lessonTitle: string
  mode?: TutorMode
  onSendMessage?: (content: string) => void
}

interface ModeEmptyConfig {
  icon: LucideIcon
  heading: string
  suggestions: string[]
}

const MODE_EMPTY_STATES: Record<TutorMode, ModeEmptyConfig> = {
  socratic: {
    icon: HelpCircle,
    heading: 'Discover through questions',
    suggestions: [
      'Help me understand the main concept here',
      'What should I focus on in this lesson?',
      'I think I understand, but can you test me?',
    ],
  },
  explain: {
    icon: BookOpen,
    heading: 'Get a clear explanation',
    suggestions: [
      'Can you explain what was just covered?',
      'What are the key takeaways so far?',
      'Break down this topic step by step',
    ],
  },
  eli5: {
    icon: Lightbulb,
    heading: 'Explain it simply',
    suggestions: [
      'Explain this like I\'m five',
      'What\'s a simple analogy for this concept?',
      'Why does this matter in everyday life?',
    ],
  },
  quiz: {
    icon: ClipboardCheck,
    heading: 'Test your knowledge',
    suggestions: [
      'Quiz me on what I just learned',
      'Give me a challenging question',
      'Start with an easy question',
    ],
  },
  debug: {
    icon: Bug,
    heading: 'Debug your understanding',
    suggestions: [
      'I think I understand this, check my reasoning',
      'Something doesn\'t make sense to me',
      'Where might I have misconceptions?',
    ],
  },
}

export function TutorEmptyState({
  lessonTitle,
  mode = 'socratic',
  onSendMessage,
}: TutorEmptyStateProps) {
  const config = MODE_EMPTY_STATES[mode]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <div className="relative mb-6">
        <Icon className="size-16 text-brand" strokeWidth={1.5} />
        <Sparkles className="size-6 text-warning absolute -top-1 -right-1" />
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-3">{config.heading}</h2>

      <p className="text-muted-foreground mb-6 max-w-md text-sm">
        I can help you understand the material in{' '}
        <span className="font-medium text-foreground">
          {lessonTitle.replace(/\.\w{2,4}$/, '')}
        </span>
        . Ask me anything about the content.
      </p>

      <div className="space-y-2 w-full max-w-sm">
        <div className="text-xs font-medium text-muted-foreground mb-1">Try asking:</div>
        {config.suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSendMessage?.(suggestion)}
            className="w-full bg-muted rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            &ldquo;{suggestion}&rdquo;
          </button>
        ))}
      </div>
    </div>
  )
}
