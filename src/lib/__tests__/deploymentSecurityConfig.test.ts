import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Cloudflare deployment security config', () => {
  it('delivers CSP as an HTTP header with effective frame protection', () => {
    const html = readProjectFile('index.html')
    const headers = readProjectFile('public/_headers')
    const cspLine = headers.split('\n').find(line => line.includes('Content-Security-Policy:'))

    expect(html).not.toContain('http-equiv="Content-Security-Policy"')
    expect(cspLine).toContain("frame-ancestors 'self'")
    expect(cspLine).toContain("object-src 'none'")
    expect(cspLine).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(cspLine?.length).toBeLessThanOrEqual(2000)
  })

  it('prevents Cloudflare transformations on HTML responses', () => {
    const headers = readProjectFile('public/_headers')
    expect(headers).toContain('Cache-Control: no-cache, no-transform')
  })

  it('leaves unsupported 404 rewrites out of the SPA redirect file', () => {
    const redirects = readProjectFile('public/_redirects')
    expect(redirects).not.toMatch(/\s404(?:\s|$)/)
    expect(redirects).toContain('/*    /index.html   200')
  })

  it('keeps service-worker activation user-controlled', () => {
    const viteConfig = readProjectFile('vite.config.ts')
    expect(viteConfig).toContain("registerType: 'prompt'")
    expect(viteConfig).not.toContain("registerType: 'autoUpdate'")
  })
})
