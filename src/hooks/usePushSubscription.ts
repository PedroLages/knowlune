import { useState, useEffect, useCallback, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushPermissionState,
} from '@/lib/pushManager'
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

    reg.pushManager.getSubscription().then((sub) => {
      if (sub) {
        subscriptionRef.current = sub
        setIsSubscribed(true)
      } else {
        subscriptionRef.current = null
        setIsSubscribed(false)
      }
    })
  }, [isSupported])

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser')
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
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
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
    } else {
      toast.error(result.error.message)
    }
  }, [])

  return {
    isSubscribed,
    subscribe,
    unsubscribe,
    permissionState,
  }
}
