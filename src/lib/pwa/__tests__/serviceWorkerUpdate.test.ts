import { afterEach, describe, expect, it, vi } from 'vitest'
import { activateLatestServiceWorker } from '../serviceWorkerUpdate'

type ControllerListener = () => void

function installServiceWorkerMock(registration: Partial<ServiceWorkerRegistration> | undefined) {
  const listeners = new Set<ControllerListener>()
  const serviceWorker = {
    getRegistration: vi.fn(async () => registration as ServiceWorkerRegistration | undefined),
    addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener as ControllerListener)
    }),
    removeEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.delete(listener as ControllerListener)
    }),
    dispatchControllerChange: () => listeners.forEach(listener => listener()),
  }

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  })
  return serviceWorker
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('activateLatestServiceWorker', () => {
  it('updates a waiting worker and waits for it to take control', async () => {
    const registration = {
      waiting: {} as ServiceWorker,
      update: vi.fn().mockResolvedValue(undefined),
    }
    const serviceWorker = installServiceWorkerMock(registration)
    const updateServiceWorker = vi.fn(async () => {
      serviceWorker.dispatchControllerChange()
    })

    await activateLatestServiceWorker(updateServiceWorker)

    expect(registration.update).toHaveBeenCalledTimes(1)
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
    expect(serviceWorker.removeEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function)
    )
  })

  it('does not wait for activation when no worker is waiting', async () => {
    const registration = {
      waiting: null,
      update: vi.fn().mockResolvedValue(undefined),
    }
    installServiceWorkerMock(registration)
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined)

    await activateLatestServiceWorker(updateServiceWorker)

    expect(registration.update).toHaveBeenCalledTimes(1)
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })
})
