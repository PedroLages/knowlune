import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'
import { useEffect } from 'react'

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('[PWA] SW registration error:', error)
    },
  })

  useEffect(() => {
    if (needRefresh) {
      toast('A new version is available', {
        duration: Infinity,
        action: {
          label: 'Update',
          onClick: () => updateServiceWorker(true),
        },
      })
    }
  }, [needRefresh, updateServiceWorker])

  return null
}
