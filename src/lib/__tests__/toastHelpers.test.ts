import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('sonner', () => {
  const toastFn = vi.fn() as ReturnType<typeof vi.fn> & {
    error: ReturnType<typeof vi.fn>
    success: ReturnType<typeof vi.fn>
    promise: ReturnType<typeof vi.fn>
    custom: ReturnType<typeof vi.fn>
  }
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  toastFn.promise = vi.fn()
  toastFn.custom = vi.fn()
  return { toast: toastFn }
})

import { toast } from 'sonner'
import { TOAST_DURATION } from '@/lib/toastConfig'
import { toastSuccess, toastError, toastPromise, toastWithUndo } from '@/lib/toastHelpers'

const mockedToast = toast as unknown as ReturnType<typeof vi.fn> & {
  error: ReturnType<typeof vi.fn>
  success: ReturnType<typeof vi.fn>
  promise: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('toastSuccess', () => {
  describe('saved', () => {
    it('shows default "Settings saved" message', () => {
      toastSuccess.saved()
      expect(mockedToast.success).toHaveBeenCalledWith('Settings saved', {
        duration: TOAST_DURATION.SHORT,
      })
    })

    it('shows custom message when provided', () => {
      toastSuccess.saved('Profile updated')
      expect(mockedToast.success).toHaveBeenCalledWith('Profile updated', {
        duration: TOAST_DURATION.SHORT,
      })
    })
  })

  describe('exported', () => {
    it('shows export message with item type', () => {
      toastSuccess.exported('Study data')
      expect(mockedToast.success).toHaveBeenCalledWith('Study data exported', {
        duration: TOAST_DURATION.SHORT,
      })
    })
  })

  describe('imported', () => {
    it('pluralizes item type for count > 1', () => {
      toastSuccess.imported(3, 'course')
      expect(mockedToast.success).toHaveBeenCalledWith('3 courses imported', {
        duration: TOAST_DURATION.SHORT,
      })
    })

    it('uses singular form for count === 1', () => {
      toastSuccess.imported(1, 'course')
      expect(mockedToast.success).toHaveBeenCalledWith('1 course imported', {
        duration: TOAST_DURATION.SHORT,
      })
    })

    it('pluralizes for count === 0', () => {
      toastSuccess.imported(0, 'session')
      expect(mockedToast.success).toHaveBeenCalledWith('0 sessions imported', {
        duration: TOAST_DURATION.SHORT,
      })
    })
  })

  describe('reset', () => {
    it('shows reset message with item type', () => {
      toastSuccess.reset('Preferences')
      expect(mockedToast.success).toHaveBeenCalledWith('Preferences reset to defaults', {
        duration: TOAST_DURATION.SHORT,
      })
    })
  })
})

describe('toastError', () => {
  describe('saveFailed', () => {
    it('shows save failed message', () => {
      toastError.saveFailed()
      expect(mockedToast.error).toHaveBeenCalledWith(
        'Save failed. Check your connection and try again.',
        { duration: TOAST_DURATION.LONG }
      )
    })

    it('logs details to console when provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      toastError.saveFailed('Network timeout')
      expect(consoleSpy).toHaveBeenCalledWith('Save error details:', 'Network timeout')
      consoleSpy.mockRestore()
    })

    it('does not log when no details provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      toastError.saveFailed()
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('importFailed', () => {
    it('shows import failed message', () => {
      toastError.importFailed()
      expect(mockedToast.error).toHaveBeenCalledWith(
        'Import failed. Check file format and try again.',
        { duration: TOAST_DURATION.LONG }
      )
    })

    it('logs details to console when provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      toastError.importFailed('Invalid JSON')
      expect(consoleSpy).toHaveBeenCalledWith('Import error details:', 'Invalid JSON')
      consoleSpy.mockRestore()
    })

    it('does not log when no details provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      toastError.importFailed()
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('invalidFile', () => {
    it('shows invalid file message with expected format', () => {
      toastError.invalidFile('JSON')
      expect(mockedToast.error).toHaveBeenCalledWith(
        'Invalid file. Please upload a valid JSON file.',
        { duration: TOAST_DURATION.LONG }
      )
    })

    it('works with CSV format', () => {
      toastError.invalidFile('CSV')
      expect(mockedToast.error).toHaveBeenCalledWith(
        'Invalid file. Please upload a valid CSV file.',
        { duration: TOAST_DURATION.LONG }
      )
    })
  })

  describe('deleteFailed', () => {
    it('shows delete failed message with item type', () => {
      toastError.deleteFailed('challenge')
      expect(mockedToast.error).toHaveBeenCalledWith(
        'Failed to delete challenge. Check your connection and try again.',
        { duration: TOAST_DURATION.LONG }
      )
    })

    it('logs details to console when provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      toastError.deleteFailed('course', 'DB write error')
      expect(consoleSpy).toHaveBeenCalledWith('Delete error details:', 'DB write error')
      consoleSpy.mockRestore()
    })

    it('does not log when no details provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      toastError.deleteFailed('course')
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})

describe('toastPromise', () => {
  it('calls toast.promise with correct config', async () => {
    const promise = Promise.resolve('done')
    toastPromise({
      promise,
      loading: 'Saving...',
      success: 'Saved!',
      error: 'Failed!',
    })
    expect(mockedToast.promise).toHaveBeenCalledWith(promise, {
      loading: 'Saving...',
      success: 'Saved!',
      error: 'Failed!',
      duration: TOAST_DURATION.MEDIUM,
    })
  })

  it('returns the original promise', async () => {
    const promise = Promise.resolve(42)
    const result = toastPromise({
      promise,
      loading: 'Loading...',
      success: 'Done',
      error: 'Error',
    })
    expect(result).toBe(promise)
    expect(await result).toBe(42)
  })

  it('supports function-based success messages', () => {
    const successFn = (data: string) => `Got ${data}`
    const promise = Promise.resolve('items')
    toastPromise({
      promise,
      loading: 'Loading...',
      success: successFn,
      error: 'Failed',
    })
    expect(mockedToast.promise).toHaveBeenCalledWith(promise, {
      loading: 'Loading...',
      success: successFn,
      error: 'Failed',
      duration: TOAST_DURATION.MEDIUM,
    })
  })
})

describe('toastWithUndo', () => {
  it('calls toast with message and undo action', () => {
    const onUndo = vi.fn()
    toastWithUndo({ message: '3 courses removed', onUndo })
    expect(mockedToast).toHaveBeenCalledWith('3 courses removed', {
      duration: TOAST_DURATION.LONG,
      action: {
        label: 'Undo',
        onClick: onUndo,
      },
    })
  })

  it('uses custom duration when provided', () => {
    const onUndo = vi.fn()
    toastWithUndo({ message: 'Deleted', onUndo, duration: 10000 })
    expect(mockedToast).toHaveBeenCalledWith('Deleted', {
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: onUndo,
      },
    })
  })

  it('defaults to LONG duration when duration is undefined', () => {
    const onUndo = vi.fn()
    toastWithUndo({ message: 'Removed', onUndo, duration: undefined })
    expect(mockedToast).toHaveBeenCalledWith('Removed', {
      duration: TOAST_DURATION.LONG,
      action: {
        label: 'Undo',
        onClick: onUndo,
      },
    })
  })
})
