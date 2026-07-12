import { describe, expect, it } from 'vitest'
import { onRequest } from '../../../functions/assets/[[path]]'

describe('Cloudflare asset handler', () => {
  it('keeps successful fingerprinted assets immutable', async () => {
    const response = await onRequest({
      next: async () =>
        new Response('export {}', {
          headers: { 'Content-Type': 'application/javascript' },
        }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/javascript')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('turns an HTML fallback into a non-cacheable 404', async () => {
    const response = await onRequest({
      next: async () =>
        new Response('<!doctype html>', {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        }),
    })

    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.text()).resolves.toBe('Asset not found')
  })
})
