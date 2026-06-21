export interface StudyInsightInputs {
  activeDaysThisMonth: number
  currentStreak: number
  previousBestStreak: number
  weeklyChange: number
  totalCompletedLessons: number
}

type TemplateFn = (inputs: StudyInsightInputs) => string | null

const templates: TemplateFn[] = [
  // No data at all
  i => (i.totalCompletedLessons === 0 ? 'Start studying to build your learning fingerprint' : null),

  // New record — consistent activity with no previous streak history
  i =>
    i.activeDaysThisMonth > 15 && i.currentStreak > 0 && i.previousBestStreak === 0
      ? `You've been consistent. ${i.activeDaysThisMonth} active days this month — a new personal record.`
      : null,

  // Best streak yet — consistent activity beating a previous best
  i =>
    i.activeDaysThisMonth > 15 && i.currentStreak > i.previousBestStreak && i.previousBestStreak > 0
      ? `You've been consistent. ${i.activeDaysThisMonth} active days this month — your best streak yet.`
      : null,

  // Getting started — few lessons completed
  i =>
    i.totalCompletedLessons < 10 && i.totalCompletedLessons > 0
      ? `${i.totalCompletedLessons} lesson${i.totalCompletedLessons !== 1 ? 's' : ''} down. Keep going — your fingerprint is forming.`
      : null,

  // Momentum — positive weekly change
  i =>
    i.weeklyChange > 0 && i.totalCompletedLessons >= 10
      ? `Up ${i.weeklyChange} lesson${i.weeklyChange !== 1 ? 's' : ''} this week. Momentum is building.`
      : null,

  // On fire — high active days (streak not necessarily a record)
  i =>
    i.activeDaysThisMonth > 15
      ? `${i.activeDaysThisMonth} active days this month. Your consistency is paying off.`
      : null,

  // Steady progress (default fallback)
  i =>
    `Steady progress. ${i.totalCompletedLessons} lesson${i.totalCompletedLessons !== 1 ? 's' : ''} completed and counting.`,
]

export function generateStudyInsight(inputs: StudyInsightInputs): string {
  for (const template of templates) {
    const result = template(inputs)
    if (result !== null) return result
  }
  // Unreachable — last template always matches
  return 'Steady progress. Keep going.'
}
