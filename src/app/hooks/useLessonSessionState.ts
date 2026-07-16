import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'

export const STUDY_TOOLS = [
  'notes',
  'bookmarks',
  'transcript',
  'summary',
  'materials',
  'tutor',
] as const

export type StudyTool = (typeof STUDY_TOOLS)[number]

const STUDY_TOOL_SET = new Set<string>(STUDY_TOOLS)
const SESSION_PREFIX = 'knowlune:lesson-session:v1'

interface StoredLessonSession {
  activeTool?: StudyTool
  scrollTop?: number
}

function isStudyTool(value: string | null): value is StudyTool {
  return value !== null && STUDY_TOOL_SET.has(value)
}

function sessionKey(courseId: string, lessonId: string): string {
  return `${SESSION_PREFIX}:${courseId}:${lessonId}`
}

function readSession(courseId: string, lessonId: string): StoredLessonSession {
  try {
    const raw = sessionStorage.getItem(sessionKey(courseId, lessonId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredLessonSession
    return {
      activeTool: isStudyTool(parsed.activeTool ?? null) ? parsed.activeTool : undefined,
      scrollTop: typeof parsed.scrollTop === 'number' ? parsed.scrollTop : undefined,
    }
  } catch {
    // silent-catch-ok — session restoration is a progressive enhancement
    return {}
  }
}

function writeSession(
  courseId: string,
  lessonId: string,
  update: Partial<StoredLessonSession>
): void {
  try {
    const current = readSession(courseId, lessonId)
    sessionStorage.setItem(
      sessionKey(courseId, lessonId),
      JSON.stringify({ ...current, ...update })
    )
  } catch {
    // silent-catch-ok — sessionStorage can be unavailable or full
  }
}

interface UseLessonSessionStateOptions {
  courseId: string
  lessonId: string
  isPdf: boolean
  titleRef: RefObject<HTMLElement | null>
}

/**
 * Keeps URL-addressable study-tool state and same-lesson scroll restoration in
 * one place. Scroll is restored for browser Back/Forward and refreshes, while a
 * normal lesson link starts at the top and focuses the new lesson heading.
 */
export function useLessonSessionState({
  courseId,
  lessonId,
  isPdf,
  titleRef,
}: UseLessonSessionStateOptions) {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const defaultTool: StudyTool = isPdf ? 'materials' : 'notes'

  const resolveTool = useCallback((): StudyTool => {
    const queryTool = new URLSearchParams(location.search).get('tool')
    if (isStudyTool(queryTool)) return queryTool
    return readSession(courseId, lessonId).activeTool ?? defaultTool
  }, [courseId, lessonId, defaultTool, location.search])

  const [activeTool, setActiveToolState] = useState<StudyTool>(resolveTool)
  const activeToolRef = useRef(activeTool)
  activeToolRef.current = activeTool

  useEffect(() => {
    const next = resolveTool()
    setActiveToolState(next)
    writeSession(courseId, lessonId, { activeTool: next })
  }, [courseId, lessonId, resolveTool])

  const setActiveTool = useCallback(
    (tool: StudyTool) => {
      setActiveToolState(tool)
      writeSession(courseId, lessonId, { activeTool: tool })

      const params = new URLSearchParams(location.search)
      params.set('tool', tool)
      navigate(
        { pathname: location.pathname, search: `?${params.toString()}` },
        { replace: true, state: location.state }
      )
    },
    [courseId, lessonId, location.pathname, location.search, location.state, navigate]
  )

  useEffect(() => {
    const scrollContainer = document.getElementById('main-content')
    if (!scrollContainer) return

    const stored = readSession(courseId, lessonId)
    const targetScroll = navigationType === 'POP' ? (stored.scrollTop ?? 0) : 0
    scrollContainer.scrollTo({ top: targetScroll, behavior: 'instant' })

    const focusFrame = requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }))
    const handleScroll = () => {
      writeSession(courseId, lessonId, { scrollTop: scrollContainer.scrollTop })
    }
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      cancelAnimationFrame(focusFrame)
      writeSession(courseId, lessonId, {
        activeTool: activeToolRef.current,
        scrollTop: scrollContainer.scrollTop,
      })
      scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [courseId, lessonId, navigationType, titleRef])

  return { activeTool, setActiveTool }
}
