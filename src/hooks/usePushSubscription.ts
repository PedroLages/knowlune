import { useState, useEffect, useCallback, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'
import { subscribeToPush, unsubscribeFromPush, getPushPermissionState } from '@/lib/pushManager'
import type { PermissionState } from '@/lib/pushManager'

/**
 * Hook for managing push notification subscription state.
 *
 * Uses `useRegisterSW` from vite-plugin-pwa to obtain the service worker
 * registration (safe to call multiple times -- vite-plugin-pwa shares the
 * same registration). Guards all PushManager calls with feature detection.
 *
 * @since E61-S01
 */
export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permissionState, setPermissionState] = useState<PermissionState>(() =>
    getPushPermissionState()
  )
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const subscriptionRef = useRef<PushSubscription | null>(null)
  const [registrationReady, setRegistrationReady] = useState(false)
  // RLB-002: Concurrency guard to prevent overlapping subscribe/unsubscribe calls
  const subscribingRef = useRef(false)
  // ADV-004: Track whether the initial getSubscription check has completed
  const subscriptionCheckCompleteRef = useRef(false)

  const isSupported =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window

  // Capture SW registration via useRegisterSW (same pattern as PWAUpdatePrompt)
  useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        registrationRef.current = registration
        setRegistrationReady(true)
      }
    },
    onRegisterError(error) {
      console.error('[Push] SW registration error:', error)
    },
  })

  // On mount and when registration changes, check for existing subscription
  useEffect(() => {
    if (!isSupported) {
      setPermissionState('unsupported')
      return
    }

    const reg = registrationRef.current
    if (!reg) return

    let ignore = false

    reg.pushManager
      .getSubscription()
      .then(sub => {
        if (ignore) return
        subscriptionCheckCompleteRef.current = true
        if (sub) {
          subscriptionRef.current = sub
          setIsSubscribed(true)
        } else {
          subscriptionRef.current = null
          setIsSubscribed(false)
        }
      })
      .catch(err => {
        // silent-catch-ok
        if (ignore) return
        subscriptionCheckCompleteRef.current = true
        console.error('[Push] getSubscription failed:', err)
      })

    return () => {
      ignore = true
    }
  }, [isSupported, registrationReady])

  // Detect mid-session permission changes (e.g. user revokes in browser settings)
  // via visibilitychange and, where available, the Permissions API.
  useEffect(() => {
    if (!isSupported) return

    let mounted = true

    // CR-001, ADV-003: Shared handler stored in a named function so it can be
    // removed from both event listeners in cleanup.
    const handlePermissionChange = () => {
      setPermissionState(getPushPermissionState())
    }

    // ADV-003: When permission is revoked, also re-check the actual subscription
    // state since the browser may have torn down the push subscription silently.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setPermissionState(getPushPermissionState())

        const reg = registrationRef.current
        if (reg) {
          reg.pushManager
            .getSubscription()
            .then(sub => {
              if (sub) {
                subscriptionRef.current = sub
                setIsSubscribed(true)
              } else {
                subscriptionRef.current = null
                setIsSubscribed(false)
              }
            })
            .catch(() => {
              // silent-catch-ok
              subscriptionRef.current = null
              setIsSubscribed(false)
            })
        }
      }
    }

    // Re-check permission when user returns to the tab
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Subscribe to browser-level permission change events
    let permStatus: PermissionStatus | null = null
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then(status => {
          // RLB-003: Guard against stale callback after unmount
          if (!mounted) return
          permStatus = status
          status.addEventListener('change', handlePermissionChange)
        })
        .catch(() => {
          // silent-catch-ok
          // Permissions API not supported for 'notifications' in this browser
        })
    }

    return () => {
      mounted = false
      // CR-001: Always clean up visibilitychange listener
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (permStatus) {
        permStatus.removeEventListener('change', handlePermissionChange)
      }
    }
  }, [isSupported])

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser')
      return
    }

    // RLB-002: Concurrency guard — prevent concurrent subscribe/unsubscribe
    if (subscribingRef.current) return
    subscribingRef.current = true

    try {
      // ADV-004: If the initial getSubscription check hasn't completed, run it
      // here to avoid creating a redundant subscription during the gap.
      if (!subscriptionCheckCompleteRef.current) {
        const reg = registrationRef.current
        if (reg) {
          const sub = await reg.pushManager.getSubscription()
          if (sub) {
            subscriptionRef.current = sub
            setIsSubscribed(true)
            return
          }
        }
        subscriptionCheckCompleteRef.current = true
      }

      // Already subscribed — return existing subscription (prevents re-subscribe
      // on Firefox where subscription already exists but user calls subscribe)
      if (subscriptionRef.current) {
        setIsSubscribed(true)
        return
      }

      const reg = registrationRef.current
      if (!reg) {
        toast.error('Service worker is not yet registered')
        return
      }

      const result = await subscribeToPush(reg)
      if (result.ok) {
        subscriptionRef.current = result.data
        setIsSubscribed(true)
        setPermissionState(getPushPermissionState())
      } else {
        const message = result.error.message
        toast.error(message)
      }
    } finally {
      subscribingRef.current = false
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    if (!isSupported) {
      setIsSubscribed(false)
      return
    }

    // RLB-002: Concurrency guard — prevent concurrent subscribe/unsubscribe
    if (subscribingRef.current) return
    subscribingRef.current = true

    try {
      const sub = subscriptionRef.current
      if (!sub) {
        setIsSubscribed(false)
        return
      }

      const result = await unsubscribeFromPush(sub)
      if (result.ok) {
        subscriptionRef.current = null
        setIsSubscribed(false)
        setPermissionState(getPushPermissionState())
        // TODO(E61-S05): Notify server to invalidate push subscription endpoint
      } else {
        toast.error(result.error.message)
      }
    } finally {
      subscribingRef.current = false
    }
  }, [])

  return {
    isSubscribed,
    subscribe,
    unsubscribe,
    permissionState,
  }
}
