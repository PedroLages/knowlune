import { assertEquals, assertExists } from 'jsr:@std/assert'
import {
  checkOrigin,
  corsHeaders,
  getAllowedOrigins,
  handlePreflight,
} from '../origin-check.ts'

const ALLOWED = ['https://knowlune.app', 'http://localhost:5173']

function makeReq(method: string, origin?: string): Request {
  const headers: Record<string, string> = {}
  if (origin) headers['Origin'] = origin
  return new Request('https://example.test/path', { method, headers })
}

Deno.test('checkOrigin: no Origin header is allowed', () => {
  assertEquals(checkOrigin(makeReq('GET'), ALLOWED), null)
})

Deno.test('checkOrigin: Origin in allow-list is allowed', () => {
  assertEquals(checkOrigin(makeReq('GET', 'https://knowlune.app'), ALLOWED), null)
})

Deno.test('checkOrigin: Origin not in allow-list returns 403', async () => {
  const res = checkOrigin(makeReq('GET', 'https://evil.test'), ALLOWED)
  assertExists(res)
  assertEquals(res!.status, 403)
  const body = await res!.json()
  assertEquals(body.error, 'Origin not allowed')
})

Deno.test('checkOrigin: empty allow-list with Origin returns 403', () => {
  const res = checkOrigin(makeReq('GET', 'https://knowlune.app'), [])
  assertExists(res)
  assertEquals(res!.status, 403)
})

Deno.test('handlePreflight: OPTIONS with allowed origin returns 204 + CORS', () => {
  const res = handlePreflight(makeReq('OPTIONS', 'https://knowlune.app'), ALLOWED)
  assertExists(res)
  assertEquals(res!.status, 204)
  assertEquals(res!.headers.get('Access-Control-Allow-Origin'), 'https://knowlune.app')
  assertEquals(res!.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS')
  assertEquals(
    res!.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type'
  )
  assertEquals(res!.headers.get('Access-Control-Max-Age'), '86400')
})

Deno.test('handlePreflight: OPTIONS with disallowed origin returns 403', () => {
  const res = handlePreflight(makeReq('OPTIONS', 'https://evil.test'), ALLOWED)
  assertExists(res)
  assertEquals(res!.status, 403)
})

Deno.test('handlePreflight: non-OPTIONS returns null', () => {
  assertEquals(handlePreflight(makeReq('GET', 'https://knowlune.app'), ALLOWED), null)
})

Deno.test('corsHeaders: echoes matched origin (not wildcard)', () => {
  const h = corsHeaders(makeReq('GET', 'https://knowlune.app'), ALLOWED)
  assertEquals(h['Access-Control-Allow-Origin'], 'https://knowlune.app')
  assertEquals(h['Vary'], 'Origin')
})

Deno.test('corsHeaders: no Origin header yields wildcard', () => {
  const h = corsHeaders(makeReq('GET'), ALLOWED)
  assertEquals(h['Access-Control-Allow-Origin'], '*')
})

Deno.test('corsHeaders: disallowed origin yields empty allow-origin', () => {
  const h = corsHeaders(makeReq('GET', 'https://evil.test'), ALLOWED)
  assertEquals(h['Access-Control-Allow-Origin'], '')
})

Deno.test('getAllowedOrigins: parses comma-separated env with trimming and empty filter', () => {
  Deno.env.set(
    'ALLOWED_ORIGINS',
    'https://knowlune.app, http://localhost:5173 ,, https://foo.test '
  )
  const list = getAllowedOrigins()
  assertEquals(list, [
    'https://knowlune.app',
    'http://localhost:5173',
    'https://foo.test',
  ])
  Deno.env.delete('ALLOWED_ORIGINS')
})

Deno.test('getAllowedOrigins: returns empty array when env unset', () => {
  Deno.env.delete('ALLOWED_ORIGINS')
  assertEquals(getAllowedOrigins(), [])
})
