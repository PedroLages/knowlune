import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

/**
 * Shared "Start studying" flow for imported course UIs: activate course, surface import errors, then navigate.
 */
export function useImportedCourseStartFlow(courseId: string) {
  const navigate = useNavigate()
  const updateCourseStatus = useCourseImportStore(s => s.updateCourseStatus)
  const busyRef = useRef(false)

  const startStudying = useCallback(
    async (e?: React.SyntheticEvent) => {
      e?.stopPropagation()
      if (busyRef.current) return
      busyRef.current = true
      try {
        await updateCourseStatus(courseId, 'active')
        const { importError } = useCourseImportStore.getState()
        if (importError) {
          toast.error(importError)
          return
        }
        navigate(`/courses/${courseId}/overview`)
      } finally {
        busyRef.current = false
      }
    },
    [courseId, navigate, updateCourseStatus]
  )

  return { startStudying }
}
