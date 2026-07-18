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

// Node 22+ exposes a native localStorage global that can shadow jsdom's Storage.
// Install distinct in-memory Storage instances so local/session fallback behavior
// and Storage.prototype spies work consistently on the Node version used by CI.
const storageData = new WeakMap<Storage, Map<string, string>>()

function createTestStorage(): Storage {
  const storage = Object.create(Storage.prototype) as Storage
  storageData.set(storage, new Map())
  return storage
}

Storage.prototype.getItem = function (key: string) {
  return storageData.get(this)?.get(key) ?? null
}
Storage.prototype.setItem = function (key: string, value: string) {
  storageData.get(this)?.set(key, String(value))
}
Storage.prototype.removeItem = function (key: string) {
  storageData.get(this)?.delete(key)
}
Storage.prototype.clear = function () {
  storageData.get(this)?.clear()
}
Object.defineProperty(Storage.prototype, 'length', {
  get(this: Storage) {
    return storageData.get(this)?.size ?? 0
  },
  configurable: true,
})
Storage.prototype.key = function (index: number) {
  return [...(storageData.get(this)?.keys() ?? [])][index] ?? null
}

for (const storageName of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, storageName, {
    value: createTestStorage(),
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement DOMMatrix — required by pdfjs-dist's canvas module
// (used for PDF page transform calculations). This is a minimal polyfill for
// module-load-time checks: pdfjs-dist references DOMMatrix at import time,
// not just during rendering. Stub methods return identity / no-op results —
// they prevent import crashes but will not produce correct values if exercised
// by real PDF rendering. Full rendering tests should run in E2E (real browser).
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixPolyfill {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
    m11 = 1
    m12 = 0
    m13 = 0
    m14 = 0
    m21 = 0
    m22 = 1
    m23 = 0
    m24 = 0
    m31 = 0
    m32 = 0
    m33 = 1
    m34 = 0
    m41 = 0
    m42 = 0
    m43 = 0
    m44 = 1
    is2D = true
    isIdentity = true
    constructor(init?: string | number[]) {
      if (typeof init === 'string') {
        // eslint-disable-next-line no-useless-escape
        const m = init.match(/matrix\(([^\)]+)\)/i)
        if (m) {
          const vals = m[1].split(',').map(Number)
          if (vals.length >= 6) {
            this.a = vals[0]
            this.b = vals[1]
            this.c = vals[2]
            this.d = vals[3]
            this.e = vals[4]
            this.f = vals[5]
            this.isIdentity = false
          }
        }
      } else if (Array.isArray(init) && init.length >= 6) {
        this.a = init[0]
        this.b = init[1]
        this.c = init[2]
        this.d = init[3]
        this.e = init[4]
        this.f = init[5]
        this.isIdentity = false
      }
    }
    translate(_x: number, _y: number) {
      return this
    }
    scale(_sx: number, _sy: number) {
      return this
    }
    rotate(_angle: number) {
      return this
    }
    multiply(_other: DOMMatrix) {
      return this
    }
    invert() {
      return this
    }
    transformPoint() {
      return { x: 0, y: 0, z: 0, w: 1 }
    }
    toFloat32Array() {
      return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    }
    toFloat64Array() {
      return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    }
    toString() {
      return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`
    }
  }
  globalThis.DOMMatrix = DOMMatrixPolyfill as unknown as typeof DOMMatrix
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
