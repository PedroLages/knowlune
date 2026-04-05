import { Shield, User, Palette, GraduationCap, Bell, Plug, type LucideIcon } from 'lucide-react'

export type SettingsCategorySlug =
  | 'account'
  | 'profile'
  | 'appearance'
  | 'learning'
  | 'notifications'
  | 'integrations'

export interface SettingsCategory {
  slug: SettingsCategorySlug
  label: string
  description: string
  icon: LucideIcon
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    slug: 'account',
    label: 'Account',
    description: 'Authentication, subscription, and data privacy',
    icon: Shield,
  },
  {
    slug: 'profile',
    label: 'Profile',
    description: 'Your identity and avatar',
    icon: User,
  },
  {
    slug: 'appearance',
    label: 'Appearance',
    description: 'Theme, fonts, accessibility, and reading modes',
    icon: Palette,
  },
  {
    slug: 'learning',
    label: 'Learning',
    description: 'Engagement, quizzes, focus mode, and study sessions',
    icon: GraduationCap,
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    description: 'Reminders, alerts, and calendar integration',
    icon: Bell,
  },
  {
    slug: 'integrations',
    label: 'Integrations & Data',
    description: 'AI, YouTube, export, import, and storage',
    icon: Plug,
  },
]

export const DEFAULT_CATEGORY: SettingsCategorySlug = 'account'
