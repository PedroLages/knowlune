import { ReminderSettings } from '@/app/components/figma/ReminderSettings'
import { NotificationPreferencesPanel } from '@/app/components/settings/NotificationPreferencesPanel'
import { CourseReminderSettings } from '@/app/components/figma/CourseReminderSettings'
import { CalendarSettingsSection } from '@/app/components/figma/CalendarSettingsSection'

export function NotificationsSection() {
  return (
    <div className="space-y-6">
      <ReminderSettings />
      <NotificationPreferencesPanel />
      <CourseReminderSettings />
      <CalendarSettingsSection />
    </div>
  )
}
