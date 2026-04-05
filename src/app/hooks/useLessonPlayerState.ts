/**
 * useLessonPlayerState — All local state for UnifiedLessonPlayer.
 *
 * Extracts useState declarations, the lesson metadata resolution effect,
 * and the reset-on-lesson-change effect from the god component.
 *
 * @see E89-S05
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CourseAdapter, LessonItem } from '@/lib/courseAdapter'
import type { CelebrationType } from '@/app/components/celebrations/CompletionModal'

export interface LessonPlayerState {
  // Auto-advance
  showAutoAdvance: boolean
  setShowAutoAdvance: React.Dispatch<React.SetStateAction<boolean>>

  // Celebration modal
  celebrationOpen: boolean
  setCelebrationOpen: React.Dispatch<React.SetStateAction<boolean>>
  celebrationType: CelebrationType
  setCelebrationType: React.Dispatch<React.SetStateAction<CelebrationType>>
  celebrationTitle: string
  setCelebrationTitle: React.Dispatch<React.SetStateAction<string>>

  // Lifted video state
  currentTime: number
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>
  seekToTime: number | undefined
  setSeekToTime: React.Dispatch<React.SetStateAction<number | undefined>>

  // Mini-player state
  isVideoVisible: boolean
  setIsVideoVisible: React.Dispatch<React.SetStateAction<boolean>>
  isVideoPlaying: boolean
  setIsVideoPlaying: React.Dispatch<React.SetStateAction<boolean>>
  isMiniPlayerDismissed: boolean
  setIsMiniPlayerDismissed: React.Dispatch<React.SetStateAction<boolean>>
  localVideoBlobUrl: string | null
  setLocalVideoBlobUrl: React.Dispatch<React.SetStateAction<string | null>>

  // Next course suggestion
  showCourseSuggestion: boolean
  setShowCourseSuggestion: React.Dispatch<React.SetStateAction<boolean>>

  // Tablet toggle
  tabletNotesOpen: boolean
  setTabletNotesOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Desktop notes side panel
  notesOpen: boolean
  setNotesOpen: React.Dispatch<React.SetStateAction<boolean>>
  pendingNoteFocus: boolean
  setPendingNoteFocus: React.Dispatch<React.SetStateAction<boolean>>
  handleNotesToggle: () => void

  // Focus tab
  focusTab: string | null
  setFocusTab: React.Dispatch<React.SetStateAction<string | null>>
  focusTabCounter: React.MutableRefObject<number>

  // Lesson metadata (resolved from adapter)
  lessonTitle: string
  lessonType: LessonItem['type'] | null
  lessonDescription: string | undefined
  lessonTags: string[] | undefined

  // Derived
  isPdf: boolean
  lessonTypeResolved: boolean

  // Handlers
  handleTimeUpdate: (time: number) => void
  handleTranscriptSeek: (time: number) => void
  handleSeekComplete: () => void
  handleFocusNotes: () => void
  handleFocusMaterials: () => void
}

export function useLessonPlayerState(
  adapter: CourseAdapter | null,
  lessonId: string | undefined
): LessonPlayerState {
  // Auto-advance state: shown when video ends and a next lesson exists
  const [showAutoAdvance, setShowAutoAdvance] = useState(false)

  // Celebration modal state
  const [celebrationOpen, setCelebrationOpen] = useState(false)
  const [celebrationType, setCelebrationType] = useState<CelebrationType>('lesson')
  const [celebrationTitle, setCelebrationTitle] = useState('')

  // Lifted video state: currentTime for transcript highlighting, seekTo for click-to-seek
  const [currentTime, setCurrentTime] = useState(0)
  const [seekToTime, setSeekToTime] = useState<number | undefined>(undefined)

  // Mini-player state (E91-S04): tracks video visibility, play state, and dismiss
  const [isVideoVisible, setIsVideoVisible] = useState(true)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isMiniPlayerDismissed, setIsMiniPlayerDismissed] = useState(false)
  const [localVideoBlobUrl, setLocalVideoBlobUrl] = useState<string | null>(null)

  // Next course suggestion state (E91-S08)
  const [showCourseSuggestion, setShowCourseSuggestion] = useState(false)

  // Tablet toggle state: switch between video and notes (E91-S09)
  const [tabletNotesOpen, setTabletNotesOpen] = useState(false)

  // Desktop notes side panel state
  const [notesOpen, setNotesOpen] = useState(false)
  const [pendingNoteFocus, setPendingNoteFocus] = useState(false)

  // Focus tab state: set to "notes" when user presses N in VideoPlayer
  const [focusTab, setFocusTab] = useState<string | null>(null)
  const focusTabCounter = useRef(0)

  // Lesson metadata resolved from adapter
  const [lessonTitle, setLessonTitle] = useState('Lesson')
  const [lessonType, setLessonType] = useState<LessonItem['type'] | null>(null)
  const [lessonDescription, setLessonDescription] = useState<string | undefined>(undefined)
  const [lessonTags, setLessonTags] = useState<string[] | undefined>(undefined)

  // Reset lifted video state when lesson changes
  useEffect(() => {
    setShowAutoAdvance(false)
    setCelebrationOpen(false)
    setCurrentTime(0)
    setSeekToTime(undefined)
    setFocusTab(null)
    // Reset mini-player state on lesson change (E91-S04)
    setIsMiniPlayerDismissed(false)
    setIsVideoVisible(true)
    setIsVideoPlaying(false)
    setLocalVideoBlobUrl(null)
    setShowCourseSuggestion(false)
    setTabletNotesOpen(false)
    setNotesOpen(false)
    setPendingNoteFocus(false)
  }, [lessonId])

  // Resolve lesson metadata (title + type) from adapter's lesson list
  useEffect(() => {
    if (!adapter || !lessonId) return
    let ignore = false
    adapter
      .getLessons()
      .then(lessons => {
        if (ignore) return
        const match = lessons.find(l => l.id === lessonId)
        setLessonTitle(match?.title ?? 'Lesson')
        setLessonType(match?.type ?? null)
        // Extract description from sourceMetadata (YouTube videos have it)
        const meta = match?.sourceMetadata
        setLessonDescription(typeof meta?.description === 'string' ? meta.description : undefined)
        // Extract tags if present in sourceMetadata
        setLessonTags(Array.isArray(meta?.tags) ? (meta.tags as string[]) : undefined)
      })
      .catch(err => {
        // silent-catch-ok — leave defaults (title='Lesson', type=null); UI degrades gracefully
        console.error('Failed to load lesson metadata:', err)
      })
    return () => {
      ignore = true
    }
  }, [adapter, lessonId])

  const isPdf = lessonType === 'pdf'
  const lessonTypeResolved = lessonType !== null

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const handleTranscriptSeek = useCallback((time: number) => {
    setSeekToTime(time)
  }, [])

  const handleSeekComplete = useCallback(() => {
    setSeekToTime(undefined)
  }, [])

  const handleFocusNotes = useCallback(() => {
    // Increment counter to re-trigger the effect even if already on "notes" tab
    focusTabCounter.current += 1
    setFocusTab(`notes`)
  }, [])

  const handleFocusMaterials = useCallback(() => {
    focusTabCounter.current += 1
    setFocusTab('materials')
  }, [])

  const handleNotesToggle = useCallback(() => {
    setNotesOpen(prev => {
      if (!prev) setPendingNoteFocus(true)
      return !prev
    })
  }, [])

  return {
    showAutoAdvance,
    setShowAutoAdvance,
    celebrationOpen,
    setCelebrationOpen,
    celebrationType,
    setCelebrationType,
    celebrationTitle,
    setCelebrationTitle,
    currentTime,
    setCurrentTime,
    seekToTime,
    setSeekToTime,
    isVideoVisible,
    setIsVideoVisible,
    isVideoPlaying,
    setIsVideoPlaying,
    isMiniPlayerDismissed,
    setIsMiniPlayerDismissed,
    localVideoBlobUrl,
    setLocalVideoBlobUrl,
    showCourseSuggestion,
    setShowCourseSuggestion,
    tabletNotesOpen,
    setTabletNotesOpen,
    notesOpen,
    setNotesOpen,
    pendingNoteFocus,
    setPendingNoteFocus,
    handleNotesToggle,
    focusTab,
    setFocusTab,
    focusTabCounter,
    lessonTitle,
    lessonType,
    lessonDescription,
    lessonTags,
    isPdf,
    lessonTypeResolved,
    handleTimeUpdate,
    handleTranscriptSeek,
    handleSeekComplete,
    handleFocusNotes,
    handleFocusMaterials,
  }
}
