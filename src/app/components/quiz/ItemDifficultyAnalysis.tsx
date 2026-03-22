import type { Quiz, QuizAttempt } from '@/types/quiz'
import { calculateItemDifficulty, type ItemDifficulty } from '@/lib/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'

interface ItemDifficultyAnalysisProps {
  quiz: Quiz
  attempts: QuizAttempt[]
}

function getDifficultyBadgeClass(difficulty: ItemDifficulty['difficulty']): string {
  switch (difficulty) {
    case 'Easy':
      return 'bg-success/10 text-success border-success/20'
    case 'Medium':
      return 'bg-warning/10 text-warning border-warning/20'
    case 'Difficult':
      return 'bg-destructive/10 text-destructive border-destructive/20'
  }
}

function buildSuggestions(items: ItemDifficulty[]): string[] {
  const difficultItems = items.filter(item => item.difficulty === 'Difficult')
  if (difficultItems.length === 0) return []

  // Group by topic
  const byTopic = new Map<string, ItemDifficulty[]>()
  for (const item of difficultItems) {
    const group = byTopic.get(item.topic) ?? []
    group.push(item)
    byTopic.set(item.topic, group)
  }

  const suggestions: string[] = []
  for (const [topic, topicItems] of byTopic) {
    const questionNums = topicItems.map(i => i.questionOrder).sort((a, b) => a - b)
    const questionWord = questionNums.length === 1 ? 'question' : 'questions'
    const avgPct = Math.round(
      (topicItems.reduce((sum, i) => sum + i.pValue, 0) / topicItems.length) * 100
    )
    const topicLabel = topic === 'General' ? '' : ` on ${topic}`
    suggestions.push(
      `Review ${questionWord} ${questionNums.join(', ')}${topicLabel} — you answer correctly only ${avgPct}% of the time.`
    )
  }

  return suggestions
}

export function ItemDifficultyAnalysis({ quiz, attempts }: ItemDifficultyAnalysisProps) {
  const items = calculateItemDifficulty(quiz, attempts)

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough data to analyze difficulty.
      </p>
    )
  }

  const suggestions = buildSuggestions(items)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Question Difficulty Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" aria-label="Questions ranked by difficulty">
          {items.map(item => (
            <li
              key={item.questionId}
              className="flex justify-between items-center gap-2"
            >
              <span
                className="text-sm truncate flex-1"
                title={item.questionText}
              >
                {item.questionText}
              </span>
              <Badge
                variant="outline"
                className={getDifficultyBadgeClass(item.difficulty)}
              >
                {item.difficulty} ({Math.round(item.pValue * 100)}%)
              </Badge>
            </li>
          ))}
        </ul>

        {suggestions.length > 0 && (
          <ul className="mt-3 space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-muted-foreground">
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
