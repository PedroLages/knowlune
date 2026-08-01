/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

const Module = require('node:module')
const path = require('node:path')

const originalResolveFilename = Module._resolveFilename
const legacyTypeScript = require.resolve('typescript-eslint-compat')

// TypeScript 7 no longer exposes the compiler API consumed by the current
// typescript-eslint release. Keep ESLint on its compatible parser runtime
// until typescript-eslint publishes TypeScript 7 support; typecheck itself
// continues to run against the project's TypeScript 7 installation.
Module._resolveFilename = function resolveFilename(request, parent, ...rest) {
  if (request === 'typescript') {
    return legacyTypeScript
  }

  return originalResolveFilename.call(this, request, parent, ...rest)
}

const eslintCli = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin/eslint.js')
require(eslintCli)
