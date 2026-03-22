import type { Quiz, Question, Answer } from '@/types/quiz'

export interface QuizScoreResult {
  score: number // raw points earned
  maxScore: number // total possible points
  percentage: number // 0-100, rounded to 1 decimal
  passed: boolean // percentage >= quiz.passingScore
  answers: Answer[] // with isCorrect and pointsEarned filled in
}

export function isCorrectAnswer(question: Question, userAnswer: string | string[]): boolean {
  const correct = question.correctAnswer

  switch (question.type) {
    case 'multiple-choice':
    case 'true-false':
      // Exact string match
      return typeof userAnswer === 'string' && userAnswer === correct

    case 'fill-in-blank':
      // Case-insensitive string match
      return (
        typeof userAnswer === 'string' &&
        typeof correct === 'string' &&
        userAnswer.trim().toLowerCase() === correct.trim().toLowerCase()
      )

    case 'multiple-select': {
      // All-or-nothing: selected set must exactly match correct set (order-independent)
      if (!Array.isArray(userAnswer) || !Array.isArray(correct)) return false
      if (userAnswer.length !== correct.length) return false
      const sortedUser = [...userAnswer].sort()
      const sortedCorrect = [...correct].sort()
      return sortedUser.every((v, i) => v === sortedCorrect[i])
    }

    default:
      return false
  }
}

export function calculatePointsForQuestion(
  question: Question,
  userAnswer: string | string[] | undefined
): { pointsEarned: number; isCorrect: boolean } {
  if (userAnswer === undefined) return { pointsEarned: 0, isCorrect: false }

  if (question.type === 'multiple-select') {
    // Partial Credit Model (PCM): (correct - incorrect) / total_correct, clamped to 0
    if (!Array.isArray(question.correctAnswer) || !Array.isArray(userAnswer)) {
      return { pointsEarned: 0, isCorrect: false }
    }
    const correctSet = new Set(question.correctAnswer)
    const userSet = new Set(userAnswer)
    const correctSelections = [...userSet].filter(a => correctSet.has(a)).length
    const incorrectSelections = [...userSet].filter(a => !correctSet.has(a)).length
    const rawScore =
      correctSet.size > 0 ? (correctSelections - incorrectSelections) / correctSet.size : 0
    const pointsEarned = Math.max(0, Math.round(rawScore * question.points * 100) / 100)
    const isCorrect = correctSelections === correctSet.size && incorrectSelections === 0
    return { pointsEarned, isCorrect }
  }

  // All other types: all-or-nothing
  const isCorrect = isCorrectAnswer(question, userAnswer)
  return { pointsEarned: isCorrect ? question.points : 0, isCorrect }
}

export function calculateQuizScore(
  quiz: Quiz,
  userAnswers: Record<string, string | string[]>
): QuizScoreResult {
  let score = 0
  let maxScore = 0
  const answers: Answer[] = []

  for (const question of quiz.questions) {
    const userAnswer = userAnswers[question.id]
    const pointsPossible = question.points
    maxScore += pointsPossible

    const { pointsEarned, isCorrect } = calculatePointsForQuestion(question, userAnswer)
    score += pointsEarned

    answers.push({
      questionId: question.id,
      userAnswer: userAnswer ?? '',
      isCorrect,
      pointsEarned,
      pointsPossible,
    })
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0
  const passed = percentage >= quiz.passingScore

  return { score, maxScore, percentage, passed, answers }
}
