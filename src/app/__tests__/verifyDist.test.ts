/**
 * Tests for the verify-dist.js post-build script.
 *
 * These tests create mock dist/ structures and verify that the script
 * correctly detects missing assets.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const TEST_DIST = path.resolve(__dirname, '../../../../tests/fixtures/verify-dist-test')
const SCRIPT = path.resolve(__dirname, '../../../../scripts/verify-dist.js')

describe('verify-dist script', () => {
  beforeAll(() => {
    // Create a mock dist structure
    if (!fs.existsSync(path.join(TEST_DIST, 'assets'))) {
      fs.mkdirSync(path.join(TEST_DIST, 'assets'), { recursive: true })
    }
  })

  afterAll(() => {
    if (fs.existsSync(TEST_DIST)) {
      fs.rmSync(TEST_DIST, { recursive: true })
    }
  })

  it('passes when all referenced assets exist', () => {
    // Setup: create index.html referencing existing assets
    const html = `<!DOCTYPE html>
<html>
<head>
  <link href="/assets/style-abc123.css" rel="stylesheet">
</head>
<body>
  <script type="module" src="/assets/index-abc123.js"></script>
  <link href="/assets/react-vendor-abc.js" rel="modulepreload">
</body>
</html>`

    fs.writeFileSync(path.join(TEST_DIST, 'index.html'), html)
    fs.writeFileSync(path.join(TEST_DIST, 'assets', 'style-abc123.css'), '')
    fs.writeFileSync(path.join(TEST_DIST, 'assets', 'index-abc123.js'), '')
    fs.writeFileSync(path.join(TEST_DIST, 'assets', 'react-vendor-abc.js'), '')

    try {
      execSync(`node ${SCRIPT}`, {
        cwd: path.resolve(__dirname, '../../../../'),
        env: { ...process.env, DIST_DIR_OVERRIDE: TEST_DIST },
      })
      // Script should exit 0 — if it throws, test fails
    } catch (error) {
      // If exit code is 1, script found missing assets
      expect.fail('verify-dist should pass when all assets exist')
    }
  })

  it('fails when a referenced asset is missing', () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <script type="module" src="/assets/index-abc123.js"></script>
  <script type="module" src="/assets/missing-chunk.js"></script>
</body>
</html>`

    // Clean and recreate
    fs.rmSync(TEST_DIST, { recursive: true })
    fs.mkdirSync(path.join(TEST_DIST, 'assets'), { recursive: true })
    fs.writeFileSync(path.join(TEST_DIST, 'index.html'), html)
    fs.writeFileSync(path.join(TEST_DIST, 'assets', 'index-abc123.js'), '')

    try {
      execSync(`node ${SCRIPT}`, {
        cwd: path.resolve(__dirname, '../../../../'),
        env: { ...process.env, DIST_DIR_OVERRIDE: TEST_DIST },
      })
      expect.fail('verify-dist should fail when an asset is missing')
    } catch (error: any) {
      expect(error.status).toBe(1)
    }
  })
})
