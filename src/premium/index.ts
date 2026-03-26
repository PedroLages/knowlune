// SPDX-License-Identifier: LicenseRef-LevelUp-Premium
//
// Copyright (c) 2026 Pedro Lages. All rights reserved.
// This file is part of the Knowlune Premium distribution.
// Unauthorized copying, modification, or distribution is strictly prohibited.
// This code is NOT covered by the AGPL-3.0 license of the open-source core.

/**
 * Premium module entry point.
 *
 * All premium components are lazy-loaded to ensure they are only bundled
 * in the premium build (vite.config.premium.ts) and never in the
 * open-source core build (vite.config.ts).
 */

import { lazy } from 'react'

// Lazy-loaded premium components
export const PremiumAnalyticsDashboard = lazy(
  () => import('./components/PremiumAnalyticsDashboard')
)

// Re-export types for premium feature registration
export type { PremiumFeatureManifest } from './types'
export { PREMIUM_FEATURE_MANIFEST } from './manifest'
