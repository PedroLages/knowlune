// SPDX-License-Identifier: LicenseRef-LevelUp-Premium
//
// Copyright (c) 2026 Pedro Lages. All rights reserved.
// This file is part of the Knowlune Premium distribution.
// Unauthorized copying, modification, or distribution is strictly prohibited.
// This code is NOT covered by the AGPL-3.0 license of the open-source core.

import type { PremiumFeatureManifest } from './types'

/**
 * Registry of all premium features.
 * The core shell uses this manifest (when available) to discover
 * premium routes and components at runtime.
 */
export const PREMIUM_FEATURE_MANIFEST: PremiumFeatureManifest[] = [
  {
    id: 'premium-analytics',
    name: 'Advanced Analytics',
    description: 'Deep learning analytics with trend analysis and predictive insights.',
    route: '/premium/analytics',
  },
]
