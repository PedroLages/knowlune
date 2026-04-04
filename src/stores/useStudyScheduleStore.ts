import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { StudySchedule, DayOfWeek } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'

interface StudyScheduleState {
  schedules: StudySchedule[]
  isLoaded: boolean

  // CRUD
  loadSchedules: () => Promise<void>
  addSchedule: (
    schedule: Omit<StudySchedule, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<StudySchedule | undefined>
  updateSchedule: (id: string, updates: Partial<StudySchedule>) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>

  // Getters
  getSchedulesForDay: (day: DayOfWeek, enabledOnly?: boolean) => StudySchedule[]
  getSchedulesForCourse: (courseId: string, enabledOnly?: boolean) => StudySchedule[]
}

export const useStudyScheduleStore = create<StudyScheduleState>((set, get) => ({
  schedules: [],
  isLoaded: false,

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
}))
