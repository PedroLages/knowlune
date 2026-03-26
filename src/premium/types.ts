// SPDX-License-Identifier: LicenseRef-LevelUp-Premium
//
// Copyright (c) 2026 Pedro Lages. All rights reserved.
// This file is part of the Knowlune Premium distribution.
// Unauthorized copying, modification, or distribution is strictly prohibited.
// This code is NOT covered by the AGPL-3.0 license of the open-source core.

/**
 * Describes a premium feature that can be registered with the core shell.
 */
export interface PremiumFeatureManifest {
  /** Unique feature identifier */
  id: string
  /** Human-readable feature name */
  name: string
  /** Short description shown in upgrade CTAs */
  description: string
  /** Route path where this feature is mounted (if applicable) */
  route?: string
}
