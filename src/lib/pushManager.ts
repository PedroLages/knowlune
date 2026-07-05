/**
 * Push notification subscription management module (E61-S01).
 *
 * Provides functions for subscribing, unsubscribing, and checking the
 * permission state of push notifications all using a Result-type error
 * handling pattern.
 *
 * @module pushManager
 * @since E61-S01
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushError {
  code: PushErrorCode
  message: string
}

export type PushErrorCode =
  | 'PERMISSION_DENIED'
  | 'SUBSCRIPTION_FAILED'
  | 'UNSUBSCRIBE_FAILED'
  | 'API_NOT_SUPPORTED'
  | 'INVALID_VAPID_KEY'

/**
 * Generic Result type for operations that can succeed or fail.
 *
 * Intended to unify the shared pattern used by PushResult, ServerResult, and
 * ParseResult across the project in a future refactor.
 *
 * @typeParam T - The success value type
 * @typeParam E - The error type (defaults to string)
 */
export type Result<T, E = string> = { ok: true; data: T } | { ok: false; error: E }

export type PushResult<T> = Result<T, PushError>

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a URL-safe base64 VAPID public key to a Uint8Array.
 *
 * Required by PushManager.subscribe({ applicationServerKey }).
 *
 * @param base64String - URL-safe base64-encoded VAPID key
 * @returns Decoded Uint8Array
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Validate input length: valid base64url padding requires len % 4 to be 0, 2, or 3
  const remainder = base64String.length % 4
  if (remainder === 1) {
    return new Uint8Array(0)
  }
  // Restore standard base64 padding
  const padding = remainder === 0 ? '' : remainder === 2 ? '==' : '='
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }

  return output
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Returns the current push notification permission state.
 *
 * Returns `'unsupported'` if the PushManager or Notification API is not
 * available in the current environment.
 */
export function getPushPermissionState(): PermissionState {
  if (
    typeof Notification === 'undefined' ||
    typeof window === 'undefined' ||
    !('PushManager' in window)
  ) {
    return 'unsupported'
  }

  return Notification.permission
}

/**
 * Subscribes the given ServiceWorkerRegistration to push notifications.
 *
 * Reads `VITE_VAPID_PUBLIC_KEY` from `import.meta.env` to use as the
 * application server key (VAPID public key).
 *
 * @param registration - The service worker registration to subscribe
 * @returns A PushResult containing the PushSubscription on success
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushResult<PushSubscription>> {
  // Guard: permission already denied (check before PushManager for lighter guard)
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return {
      ok: false,
      error: { code: 'PERMISSION_DENIED', message: 'Notification permission has been denied' },
    }
  }

  // Guard: PushManager availability
  if (typeof window === 'undefined' || !('PushManager' in window) || !registration.pushManager) {
    return {
      ok: false,
      error: {
        code: 'API_NOT_SUPPORTED',
        message: 'PushManager is not available in this environment',
      },
    }
  }

  // Read VAPID public key from environment
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!vapidKey) {
    return {
      ok: false,
      error: { code: 'INVALID_VAPID_KEY', message: 'VITE_VAPID_PUBLIC_KEY is not configured' },
    }
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    })

    return { ok: true, data: subscription }
  } catch (err) {
    // Catch atob failures from invalid VAPID key first
    if (err instanceof DOMException && err.name === 'InvalidCharacterError') {
      return {
        ok: false,
        error: { code: 'INVALID_VAPID_KEY', message: 'VITE_VAPID_PUBLIC_KEY is not valid base64' },
      }
    }
    const message = err instanceof Error ? err.message : 'Unknown error during subscription'
    return {
      ok: false,
      error: { code: 'SUBSCRIPTION_FAILED', message },
    }
  }
}

/**
 * Unsubscribes from push notifications for the given subscription.
 *
 * @param subscription - The push subscription to unsubscribe
 * @returns A PushResult indicating success or failure
 */
export async function unsubscribeFromPush(
  subscription: PushSubscription
): Promise<PushResult<void>> {
  try {
    await subscription.unsubscribe()
    return { ok: true, data: undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during unsubscription'
    return {
      ok: false,
      error: { code: 'UNSUBSCRIBE_FAILED', message },
    }
  }
}
