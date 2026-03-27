import { describe, it, expect, beforeEach } from 'vitest'
import { useImportProgressStore } from '@/stores/useImportProgressStore'

beforeEach(() => {
  useImportProgressStore.getState().reset()
})

describe('useImportProgressStore initial state', () => {
  it('should have correct defaults', () => {
    const state = useImportProgressStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.isVisible).toBe(false)
    expect(state.courses.size).toBe(0)
    expect(state.cancelRequested).toBe(false)
  })
})

describe('startImport', () => {
  it('should add a course with scanning phase', () => {
    useImportProgressStore.getState().startImport('c1', 'React Course')

    const state = useImportProgressStore.getState()
    expect(state.isActive).toBe(true)
    expect(state.isVisible).toBe(true)
    expect(state.cancelRequested).toBe(false)
    expect(state.courses.size).toBe(1)

    const course = state.courses.get('c1')!
    expect(course.courseName).toBe('React Course')
    expect(course.phase).toBe('scanning')
    expect(course.filesProcessed).toBe(0)
    expect(course.totalFiles).toBeNull()
  })
})

describe('updateScanProgress', () => {
  it('should update scan progress for active course', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().updateScanProgress('c1', 10, 50)

    const course = useImportProgressStore.getState().courses.get('c1')!
    expect(course.filesProcessed).toBe(10)
    expect(course.totalFiles).toBe(50)
    expect(course.phase).toBe('scanning')
  })

  it('should not update completed course', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().completeCourse('c1')
    useImportProgressStore.getState().updateScanProgress('c1', 99, 100)

    expect(useImportProgressStore.getState().courses.get('c1')!.phase).toBe('complete')
  })

  it('should not update cancelled course', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().cancelImport()
    useImportProgressStore.getState().confirmCancellation()
    useImportProgressStore.getState().updateScanProgress('c1', 99, 100)

    expect(useImportProgressStore.getState().courses.get('c1')!.phase).toBe('cancelled')
  })

  it('should handle non-existent courseId gracefully', () => {
    useImportProgressStore.getState().updateScanProgress('nonexistent', 10, 50)
    // No crash, no new entries
    expect(useImportProgressStore.getState().courses.size).toBe(0)
  })
})

describe('updateProcessingProgress', () => {
  it('should update processing progress', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().updateProcessingProgress('c1', 5, 20)

    const course = useImportProgressStore.getState().courses.get('c1')!
    expect(course.phase).toBe('processing')
    expect(course.filesProcessed).toBe(5)
    expect(course.totalFiles).toBe(20)
  })

  it('should not update completed course', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().completeCourse('c1')
    useImportProgressStore.getState().updateProcessingProgress('c1', 5, 20)

    expect(useImportProgressStore.getState().courses.get('c1')!.phase).toBe('complete')
  })

  it('should not update cancelled course', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().cancelImport()
    useImportProgressStore.getState().confirmCancellation()
    useImportProgressStore.getState().updateProcessingProgress('c1', 5, 20)

    expect(useImportProgressStore.getState().courses.get('c1')!.phase).toBe('cancelled')
  })
})

describe('completeCourse', () => {
  it('should mark course as complete', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().completeCourse('c1')

    const course = useImportProgressStore.getState().courses.get('c1')!
    expect(course.phase).toBe('complete')
  })

  it('should set isActive to false when all courses are done', () => {
    useImportProgressStore.getState().startImport('c1', 'Course 1')
    useImportProgressStore.getState().startImport('c2', 'Course 2')

    useImportProgressStore.getState().completeCourse('c1')
    expect(useImportProgressStore.getState().isActive).toBe(true) // c2 still active

    useImportProgressStore.getState().completeCourse('c2')
    expect(useImportProgressStore.getState().isActive).toBe(false) // all done
  })

  it('should handle non-existent courseId', () => {
    useImportProgressStore.getState().completeCourse('nonexistent')
    // No crash
  })
})

describe('failCourse', () => {
  it('should set error on course', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().failCourse('c1', 'Permission denied')

    const course = useImportProgressStore.getState().courses.get('c1')!
    expect(course.error).toBe('Permission denied')
  })

  it('should set isActive to false when all courses failed or complete', () => {
    useImportProgressStore.getState().startImport('c1', 'Course 1')
    useImportProgressStore.getState().startImport('c2', 'Course 2')

    useImportProgressStore.getState().failCourse('c1', 'Error')
    expect(useImportProgressStore.getState().isActive).toBe(true)

    useImportProgressStore.getState().completeCourse('c2')
    expect(useImportProgressStore.getState().isActive).toBe(false)
  })

  it('should handle non-existent courseId', () => {
    useImportProgressStore.getState().failCourse('nonexistent', 'Error')
    // No crash
  })
})

describe('cancelImport', () => {
  it('should set cancelRequested flag', () => {
    useImportProgressStore.getState().cancelImport()
    expect(useImportProgressStore.getState().cancelRequested).toBe(true)
  })
})

describe('confirmCancellation', () => {
  it('should mark all active courses as cancelled', () => {
    useImportProgressStore.getState().startImport('c1', 'Course 1')
    useImportProgressStore.getState().startImport('c2', 'Course 2')
    useImportProgressStore.getState().completeCourse('c1') // Already done

    useImportProgressStore.getState().confirmCancellation()

    expect(useImportProgressStore.getState().courses.get('c1')!.phase).toBe('complete') // unchanged
    expect(useImportProgressStore.getState().courses.get('c2')!.phase).toBe('cancelled')
    expect(useImportProgressStore.getState().isActive).toBe(false)
    expect(useImportProgressStore.getState().cancelRequested).toBe(false)
  })

  it('should not cancel courses with errors', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().failCourse('c1', 'Some error')
    useImportProgressStore.getState().confirmCancellation()

    // Course with error should not have phase changed to cancelled
    expect(useImportProgressStore.getState().courses.get('c1')!.error).toBe('Some error')
  })
})

describe('dismissOverlay / showOverlay', () => {
  it('should toggle visibility', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    expect(useImportProgressStore.getState().isVisible).toBe(true)

    useImportProgressStore.getState().dismissOverlay()
    expect(useImportProgressStore.getState().isVisible).toBe(false)

    useImportProgressStore.getState().showOverlay()
    expect(useImportProgressStore.getState().isVisible).toBe(true)
  })
})

describe('reset', () => {
  it('should reset all state', () => {
    useImportProgressStore.getState().startImport('c1', 'Course')
    useImportProgressStore.getState().reset()

    const state = useImportProgressStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.isVisible).toBe(false)
    expect(state.courses.size).toBe(0)
    expect(state.cancelRequested).toBe(false)
  })
})
