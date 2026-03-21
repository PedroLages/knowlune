import { toast } from 'sonner'
import { TOAST_DURATION } from './toastConfig'

/**
 * Configuration for promise-based toast notifications.
 * @template T The type of data returned by the promise
 */
export interface PromiseToastConfig<T> {
  /** The promise to track */
  promise: Promise<T>
  /** Message displayed while loading */
  loading: string
  /** Message displayed on success (can use promise result) */
  success: string | ((data: T) => string)
  /** Message displayed on error */
  error: string
}

/**
 * Configuration for undo-capable toast notifications.
 */
export interface UndoToastConfig {
  /** Message describing the action (e.g., "3 courses removed") */
  message: string
  /** Callback executed when undo is clicked */
  onUndo: () => void
  /** Custom duration (defaults to LONG for read time) */
  duration?: number
}

/**
 * Success toast variants for common operations.
 * All use SHORT duration (3s) for quick acknowledgment.
 */
export const toastSuccess = {
  /**
   * Displays a success toast for save operations.
   * @param message Custom message (default: "Settings saved")
   * @example toastSuccess.saved() // "Settings saved"
   * @example toastSuccess.saved("Profile updated") // "Profile updated"
   */
  saved: (message = 'Settings saved') => {
    toast.success(message, { duration: TOAST_DURATION.SHORT })
  },

  /**
   * Displays a success toast for export operations.
   * @param itemType Type of item exported (e.g., "Study data", "Progress")
   * @example toastSuccess.exported('Study data') // "Study data exported"
   */
  exported: (itemType: string) => {
    toast.success(`${itemType} exported`, { duration: TOAST_DURATION.SHORT })
  },

  /**
   * Displays a success toast for import operations.
   * @param count Number of items imported
   * @param itemType Type of item imported (e.g., "courses", "sessions")
   * @example toastSuccess.imported(3, 'courses') // "3 courses imported"
   */
  imported: (count: number, itemType: string) => {
    const plural = count === 1 ? itemType : itemType + 's'
    toast.success(`${count} ${plural} imported`, {
      duration: TOAST_DURATION.SHORT,
    })
  },

  /**
   * Displays a success toast for reset operations.
   * @param itemType Type of item reset (e.g., "Preferences", "Progress")
   * @example toastSuccess.reset('Preferences') // "Preferences reset to defaults"
   */
  reset: (itemType: string) => {
    toast.success(`${itemType} reset to defaults`, {
      duration: TOAST_DURATION.SHORT,
    })
  },
}

/**
 * Error toast variants with actionable guidance.
 * All use LONG duration (8s) to give users time to read and act.
 */
export const toastError = {
  /**
   * Displays an error toast for failed save operations.
   * Provides actionable guidance (check connection, try again).
   * @param details Optional technical details for debugging
   * @example toastError.saveFailed() // "Save failed. Check your connection and try again."
   * @example toastError.saveFailed('Network timeout') // Logs to console for debugging
   */
  saveFailed: (details?: string) => {
    toast.error('Save failed. Check your connection and try again.', {
      duration: TOAST_DURATION.LONG,
    })
    if (details) {
      console.error('Save error details:', details)
    }
  },

  /**
   * Displays an error toast for failed import operations.
   * Guides users to verify file format.
   * @param details Optional technical details for debugging
   * @example toastError.importFailed() // "Import failed. Check file format and try again."
   */
  importFailed: (details?: string) => {
    toast.error('Import failed. Check file format and try again.', {
      duration: TOAST_DURATION.LONG,
    })
    if (details) {
      console.error('Import error details:', details)
    }
  },

  /**
   * Displays an error toast for invalid file uploads.
   * Specifies expected file format.
   * @param expectedFormat Expected file format (e.g., "JSON", "CSV")
   * @example toastError.invalidFile('JSON') // "Invalid file. Please upload a valid JSON file."
   */
  invalidFile: (expectedFormat: string) => {
    toast.error(`Invalid file. Please upload a valid ${expectedFormat} file.`, {
      duration: TOAST_DURATION.LONG,
    })
  },

  /**
   * Displays an error toast for failed delete operations.
   * Guides users to check connection and retry.
   * @param itemType Type of item that failed to delete (e.g., "challenge", "course")
   * @param details Optional technical details for debugging
   * @example toastError.deleteFailed('challenge') // "Failed to delete challenge. Check your connection and try again."
   */
  deleteFailed: (itemType: string, details?: string) => {
    toast.error(`Failed to delete ${itemType}. Check your connection and try again.`, {
      duration: TOAST_DURATION.LONG,
    })
    if (details) {
      console.error('Delete error details:', details)
    }
  },
}

/**
 * Warning toast variants for non-blocking advisories.
 * Use LONG duration (8s) to give users time to read.
 */
export const toastWarning = {
  /**
   * Displays a warning toast when localStorage quota is exceeded.
   * Advises the user that progress is session-only and suggests clearing data.
   * Non-blocking — does not interrupt quiz functionality.
   */
  storageQuota: () => {
    toast.warning(
      'Storage limit reached. Quiz progress will be saved for this session only. Try clearing browser data to fix this.',
      { duration: TOAST_DURATION.LONG }
    )
  },
}

/**
 * Displays a promise-based toast that updates based on async operation state.
 * Automatically handles loading → success/error transitions.
 *
 * @template T The type of data returned by the promise
 * @param config Configuration object with promise and messages
 * @returns The original promise (allows chaining)
 *
 * @example
 * toastPromise({
 *   promise: saveSettings(),
 *   loading: 'Saving settings...',
 *   success: 'Settings saved successfully',
 *   error: 'Failed to save settings'
 * })
 *
 * @example
 * // With dynamic success message
 * toastPromise({
 *   promise: exportData(),
 *   loading: 'Exporting...',
 *   success: (data) => `Exported ${data.count} items`,
 *   error: 'Export failed'
 * })
 */
export function toastPromise<T>(config: PromiseToastConfig<T>): Promise<T> {
  // Show toast and return the original promise
  toast.promise(config.promise, {
    loading: config.loading,
    success: config.success,
    error: config.error,
    duration: TOAST_DURATION.MEDIUM,
  })

  return config.promise
}

/**
 * Displays a toast with an undo action button.
 * Uses LONG duration (8s) to give users time to review and act.
 * Action is executed immediately but can be reversed via undo.
 *
 * @param config Configuration object with message and undo callback
 *
 * @example
 * const removedCourses = [course1, course2, course3]
 * toastWithUndo({
 *   message: '3 courses removed',
 *   onUndo: () => {
 *     // Restore removed courses
 *     restoreCourses(removedCourses)
 *   }
 * })
 */
export function toastWithUndo(config: UndoToastConfig): void {
  toast(config.message, {
    duration: config.duration ?? TOAST_DURATION.LONG,
    action: {
      label: 'Undo',
      onClick: config.onUndo,
    },
  })
}
