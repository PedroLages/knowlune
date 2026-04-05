import { EngagementPreferences } from '@/app/components/settings/EngagementPreferences'
import { QuizPreferencesForm } from '@/app/components/settings/QuizPreferencesForm'
import { FocusModeSettings } from '@/app/components/settings/FocusModeSettings'
import { PomodoroSettings } from '@/app/components/settings/PomodoroSettings'

export function LearningSection() {
  return (
    <div className="space-y-6">
      <EngagementPreferences />
      <QuizPreferencesForm />
      <FocusModeSettings />
      <PomodoroSettings />
    </div>
  )
}
