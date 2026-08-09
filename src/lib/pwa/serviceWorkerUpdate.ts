type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>

const CONTROLLER_CHANGE_TIMEOUT_MS = 5_000

function waitForControllerChange(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve()
  }

  return new Promise(resolve => {
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const finish = () => {
      if (settled) return
      settled = true
      if (timeoutId !== null) clearTimeout(timeoutId)
      navigator.serviceWorker.removeEventListener('controllerchange', finish)
      resolve()
    }

    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true })
    timeoutId = setTimeout(finish, CONTROLLER_CHANGE_TIMEOUT_MS)
  })
}

/**
 * Update the registered worker before reloading a protocol-blocked client.
 *
 * A direct `location.reload()` immediately after `SKIP_WAITING` can race the
 * worker activation and reload the same stale bundle. This helper forces an
 * update check, asks the waiting worker to activate through the PWA hook, and
 * waits for control to change before the caller reloads the document.
 */
export async function activateLatestServiceWorker(
  updateServiceWorker: UpdateServiceWorker
): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    await updateServiceWorker(true)
    return
  }

  const registration = await navigator.serviceWorker.getRegistration()
  await registration?.update()

  // If the update check found no waiting worker, the PWA hook still gets a
  // chance to complete registration, but there is no activation to await.
  if (!registration?.waiting) {
    await updateServiceWorker(true)
    return
  }

  const controllerChanged = waitForControllerChange()
  await updateServiceWorker(true)
  await controllerChanged
}
