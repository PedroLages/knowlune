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

// jsdom does not implement DOMMatrix — required by pdfjs-dist's canvas module
// (used for PDF page transform calculations). DOMMatrix is a standard Web API
// for 2D/3D matrix operations. pdfjs-dist references it at module load time,
// not just during rendering, so it must be polyfilled before any import.
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixPolyfill {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    m11 = 1; m12 = 0; m13 = 0; m14 = 0
    m21 = 0; m22 = 1; m23 = 0; m24 = 0
    m31 = 0; m32 = 0; m33 = 1; m34 = 0
    m41 = 0; m42 = 0; m43 = 0; m44 = 1
    is2D = true
    isIdentity = true
    constructor(init?: string | number[]) {
      if (typeof init === 'string') {
        // eslint-disable-next-line no-useless-escape
        const m = init.match(/matrix\(([^\)]+)\)/i)
        if (m) {
          const vals = m[1].split(',').map(Number)
          if (vals.length >= 6) {
            this.a = vals[0]; this.b = vals[1]
            this.c = vals[2]; this.d = vals[3]
            this.e = vals[4]; this.f = vals[5]
          }
        }
      }
    }
    translate(_x: number, _y: number) { return this }
    scale(_sx: number, _sy: number) { return this }
    rotate(_angle: number) { return this }
    multiply(_other: DOMMatrix) { return this }
    invert() { return this }
    transformPoint() { return { x: 0, y: 0, z: 0, w: 1 } }
    toFloat32Array() { return new Float32Array([1,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1]) }
    toFloat64Array() { return new Float64Array([1,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1]) }
    toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})` }
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
