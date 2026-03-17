import type { Quiz, Question, Answer } from '@/types/quiz'

export interface QuizScoreResult {
  score: number // raw points earned
  maxScore: number // total possible points
  percentage: number // 0-100, rounded to 1 decimal
  passed: boolean // percentage >= quiz.passingScore
  answers: Answer[] // with isCorrect and pointsEarned filled in
}

function isCorrectAnswer(question: Question, userAnswer: string | string[]): boolean {
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

    // Treat unanswered questions as incorrect
    const answered = userAnswer !== undefined
    const isCorrect = answered ? isCorrectAnswer(question, userAnswer) : false
    const pointsEarned = isCorrect ? pointsPossible : 0
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
