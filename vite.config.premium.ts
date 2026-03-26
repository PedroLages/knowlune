/// <reference types="vitest/config" />
/// <reference types="vitest" />
/**
 * Premium build configuration.
 *
 * Extends the core vite.config.ts with:
 * - Premium import guard DISABLED (allows @/premium/* imports)
 * - src/premium/ included in the build
 * - Premium-specific chunk splitting
 *
 * Usage: npm run build:premium
 */
import { defineConfig, mergeConfig, type UserConfig } from 'vite'
import baseConfigFn from './vite.config'

// The base config is a resolved config object (defineConfig returns UserConfig)
const baseConfig = baseConfigFn as unknown as UserConfig

export default defineConfig(() => {
  return mergeConfig(baseConfig, {
    // Override plugins: the premium-import-guard from the base config
    // is automatically disabled because it checks the `enabled` option.
    // We inject a no-op replacement via define.
    define: {
      __PREMIUM_BUILD__: JSON.stringify(true),
    },
    build: {
      outDir: 'dist-premium',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // Premium-specific chunk
            if (id.includes('src/premium/')) {
              return 'premium'
            }
            // Fall through to base config's manualChunks
            return undefined
          },
        },
      },
    },
  } satisfies UserConfig)
})
