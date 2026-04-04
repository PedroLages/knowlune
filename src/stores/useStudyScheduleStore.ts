import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { StudySchedule, DayOfWeek } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { supabase } from '@/lib/auth/supabase'

/**
 * Generates a 40-character hex token (160-bit entropy) using Web Crypto API.
 * Safe for browser environments — does NOT use Node's crypto.randomBytes.
 */
function generateHexToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

interface StudyScheduleState {
  schedules: StudySchedule[]
  isLoaded: boolean

  // Feed token management
  feedToken: string | null
  feedEnabled: boolean
  feedLoading: boolean

  // CRUD
  loadSchedules: () => Promise<void>
  addSchedule: (
    schedule: Omit<StudySchedule, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<StudySchedule | undefined>
  updateSchedule: (id: string, updates: Partial<StudySchedule>) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>

  // Feed token
  loadFeedToken: () => Promise<void>
  generateFeedToken: () => Promise<string | null>
  regenerateFeedToken: () => Promise<string | null>
  disableFeed: () => Promise<void>
  getFeedUrl: () => string | null

  // Getters
  getSchedulesForDay: (day: DayOfWeek, enabledOnly?: boolean) => StudySchedule[]
  getSchedulesForCourse: (courseId: string, enabledOnly?: boolean) => StudySchedule[]
}

export const useStudyScheduleStore = create<StudyScheduleState>((set, get) => ({
  schedules: [],
  isLoaded: false,
  feedToken: null,
  feedEnabled: false,
  feedLoading: false,

  loadSchedules: async () => {
    try {
      const schedules = await db.studySchedules.toArray()
      set({ schedules, isLoaded: true })
    } catch (error) {
      console.error('[StudyScheduleStore] Failed to load schedules:', error)
      toast.error('Failed to load study schedules')
    }
  },

  addSchedule: async input => {
    const now = new Date().toISOString()
    const newSchedule: StudySchedule = {
      ...input,
      timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }

    try {
      await persistWithRetry(async () => {
        await db.studySchedules.add(newSchedule)
      })
      set(state => ({ schedules: [...state.schedules, newSchedule] }))
      return newSchedule
    } catch (error) {
      console.error('[StudyScheduleStore] Failed to add schedule:', error)
      toast.error('Failed to create study schedule')
      return undefined
    }
  },

  updateSchedule: async (id, updates) => {
    const { schedules } = get()
    const existing = schedules.find(s => s.id === id)
    if (!existing) return

    const updatedSchedule: StudySchedule = {
      ...existing,
      ...updates,
      id, // Prevent id override
      updatedAt: new Date().toISOString(),
    }

    try {
      await persistWithRetry(async () => {
        await db.studySchedules.put(updatedSchedule)
      })
      set(state => ({
        schedules: state.schedules.map(s => (s.id === id ? updatedSchedule : s)),
      }))
    } catch (error) {
      console.error('[StudyScheduleStore] Failed to update schedule:', error)
      toast.error('Failed to update study schedule')
    }
  },

  deleteSchedule: async id => {
    const { schedules } = get()
    const existing = schedules.find(s => s.id === id)
    if (!existing) return

    try {
      await persistWithRetry(async () => {
        await db.studySchedules.delete(id)
      })
      set(state => ({
        schedules: state.schedules.filter(s => s.id !== id),
      }))
    } catch (error) {
      console.error('[StudyScheduleStore] Failed to delete schedule:', error)
      toast.error('Failed to delete study schedule')
    }
  },

  getSchedulesForDay: (day, enabledOnly = true) => {
    return get().schedules.filter(s => s.days.includes(day) && (!enabledOnly || s.enabled))
  },

  getSchedulesForCourse: (courseId, enabledOnly = true) => {
    return get().schedules.filter(s => s.courseId === courseId && (!enabledOnly || s.enabled))
  },

  // --- Feed token management ---

  loadFeedToken: async () => {
    if (!supabase) return
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('token')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      set({
        feedToken: data?.token ?? null,
        feedEnabled: !!data?.token,
      })
    } catch (error) {
      console.error('[StudyScheduleStore] Failed to load feed token:', error)
    }
  },

  generateFeedToken: async () => {
    if (!supabase) {
      toast.error('Supabase is not configured')
      return null
    }
    const { feedLoading } = get()
    if (feedLoading) return null

    set({ feedLoading: true })
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be signed in to enable the calendar feed')
        return null
      }

      const token = generateHexToken()
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      const { error } = await supabase
        .from('calendar_tokens')
        .upsert({ user_id: user.id, token, timezone }, { onConflict: 'user_id' })

      if (error) throw error

      set({ feedToken: token, feedEnabled: true })
      return token
    } catch (error) {
      console.error('[StudyScheduleStore] Failed to generate feed token:', error)
      toast.error('Failed to enable calendar feed')
      return null
    } finally {
      set({ feedLoading: false })
    }
  },

  regenerateFeedToken: async () => {
    if (!supabase) {
      toast.error('Supabase is not configured')
      return null
    }
    const { feedLoading } = get()
    if (feedLoading) return null

    set({ feedLoading: true })
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be signed in to regenerate the feed URL')
        return null
      }

      // Delete old token first — old URL immediately invalidated
      await supabase.from('calendar_tokens').delete().eq('user_id', user.id)

      // Insert new token
      const token = generateHexToken()
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      const { error } = await supabase
        .from('calendar_tokens')
        .insert({ user_id: user.id, token, timezone })

      if (error) throw error

      set({ feedToken: token, feedEnabled: true })
      toast.success('Feed URL regenerated. Update your calendar subscription.')
      return token
    } catch (error) {
      console.error('[StudyScheduleStore] Failed to regenerate feed token:', error)
      toast.error('Failed to regenerate feed URL')
      return null
    } finally {
      set({ feedLoading: false })
    }
  },

  disableFeed: async () => {
    if (!supabase) {
      toast.error('Supabase is not configured')
      return
    }
    const { feedLoading } = get()
    if (feedLoading) return

    set({ feedLoading: true })
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('calendar_tokens').delete().eq('user_id', user.id)

      if (error) throw error

      set({ feedToken: null, feedEnabled: false })
      toast.success('Calendar feed disabled')
    } catch (error) {
      console.error('[StudyScheduleStore] Failed to disable feed:', error)
      toast.error('Failed to disable calendar feed')
    } finally {
      set({ feedLoading: false })
    }
  },

  getFeedUrl: () => {
    const { feedToken } = get()
    if (!feedToken) return null
    const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin
    return `${baseUrl}/api/calendar/${feedToken}.ics`
  },
}))
