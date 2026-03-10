/**
 * Browser API type declarations for non-standard and experimental features
 */

// WebGPU API (experimental, available in Chrome/Edge 113+, Safari 17+)
interface Navigator {
  gpu?: GPU
}

// Performance memory (non-standard, Chrome-only)
interface Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}
