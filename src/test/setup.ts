import '@testing-library/jest-dom'

// jsdom does not implement ResizeObserver — required by Radix UI components
// (Select, Dialog, Collapsible, etc.) that use @radix-ui/react-use-size.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom does not implement IntersectionObserver — required by components that
// use viewport intersection detection (lazy loading, scroll-based effects).
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver
}

// Node 22+ ships a native localStorage that conflicts with jsdom's
// implementation — its API is incomplete (e.g. clear() is not a function).
// Override globalThis.localStorage with a standards-compliant in-memory
// Storage backed by Storage.prototype so vi.spyOn(Storage.prototype, ...)
// works correctly in tests that mock localStorage methods.
const store = new Map<string, string>()
Storage.prototype.getItem = (key: string) => store.get(key) ?? null
Storage.prototype.setItem = (key: string, value: string) => {
  store.set(key, String(value))
}
Storage.prototype.removeItem = (key: string) => {
  store.delete(key)
}
Storage.prototype.clear = () => {
  store.clear()
}
Object.defineProperty(Storage.prototype, 'length', { get: () => store.size, configurable: true })
Storage.prototype.key = (index: number) => [...store.keys()][index] ?? null
// Ensure globalThis.localStorage is a Storage instance so prototype methods resolve
if (!(globalThis.localStorage instanceof Storage)) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: Object.create(Storage.prototype),
    writable: true,
  })
}

// jsdom does not implement window.matchMedia — provide a no-op stub
// so components that check prefers-reduced-motion can render in tests.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
