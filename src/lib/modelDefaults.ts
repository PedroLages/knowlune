/**
 * Shared Model Constants and Feature Configuration
 *
 * Centralizes AI model defaults that were previously scattered across
 * aiSummary.ts, noteQA.ts, and server/providers.ts with conflicting values.
 *
 * Importable by both Vite client and Express server to prevent divergence.
 *
 * @see E90-S01 — Define Shared Model Constants and Feature Model Config Type
 */

import type { AIProviderId } from './aiConfiguration'

// ---------------------------------------------------------------------------
// AI Feature Identification
// ---------------------------------------------------------------------------

/**
 * Union type enumerating all AI-powered features in Knowlune.
 * Used for per-feature model override configuration.
 */
export type AIFeatureId =
  | 'videoSummary'
  | 'noteQA'
  | 'thumbnailGeneration'
  | 'quizGeneration'
  | 'flashcardGeneration'
  | 'learningPath'
  | 'knowledgeGaps'
  | 'noteOrganization'
  | 'analytics'

/**
 * All valid AI feature IDs as a runtime array (for validation and iteration).
 */
export const AI_FEATURE_IDS: readonly AIFeatureId[] = [
  'videoSummary',
  'noteQA',
  'thumbnailGeneration',
  'quizGeneration',
  'flashcardGeneration',
  'learningPath',
  'knowledgeGaps',
  'noteOrganization',
  'analytics',
] as const

// ---------------------------------------------------------------------------
// Per-Feature Model Configuration
// ---------------------------------------------------------------------------

/**
 * User-configurable model override for a specific AI feature.
 */
export interface FeatureModelConfig {
  /** AI provider for this feature */
  provider: AIProviderId
  /** Model identifier (e.g., "claude-haiku-4-5", "gpt-4o-mini") */
  model: string
  /** Sampling temperature (0.0–2.0). Lower = more deterministic. */
  temperature?: number
  /** Maximum output tokens. Provider-dependent upper bound. */
  maxTokens?: number
}

// ---------------------------------------------------------------------------
// Provider Defaults
// ---------------------------------------------------------------------------

/**
 * Canonical default model per provider.
 *
 * Resolves the gpt-4o-mini vs gpt-4-turbo conflict — gpt-4o-mini is cheaper
 * and newer, so it becomes the canonical OpenAI default.
 *
 * Replaces duplicate maps in:
 * - aiSummary.ts PROVIDER_MODELS (line 108-115)
 * - noteQA.ts getModel() (lines 35-58)
 * - server/providers.ts DEFAULT_MODELS (lines 17-23)
 */
export const PROVIDER_DEFAULTS: Record<AIProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  groq: 'llama-3.3-70b-versatile',
  glm: 'glm-4-flash',
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3.2',
}

// ---------------------------------------------------------------------------
// Feature Defaults
// ---------------------------------------------------------------------------

/**
 * Recommended default model per AI feature.
 *
 * These are the "out of the box" assignments when a user has not set
 * per-feature overrides. Chosen for cost-efficiency and task fit:
 * - Summaries/QA: Haiku (fast, cheap, good enough for extraction)
 * - Generation tasks: Haiku (structured output, fast iteration)
 * - Analytics/paths: Haiku (pattern matching, low latency)
 */
export const FEATURE_DEFAULTS: Record<AIFeatureId, { provider: AIProviderId; model: string }> = {
  videoSummary: { provider: 'anthropic', model: 'claude-haiku-4-5' },
  noteQA: { provider: 'anthropic', model: 'claude-haiku-4-5' },
  thumbnailGeneration: { provider: 'openai', model: 'gpt-4o-mini' },
  quizGeneration: { provider: 'anthropic', model: 'claude-haiku-4-5' },
  flashcardGeneration: { provider: 'anthropic', model: 'claude-haiku-4-5' },
  learningPath: { provider: 'anthropic', model: 'claude-haiku-4-5' },
  knowledgeGaps: { provider: 'anthropic', model: 'claude-haiku-4-5' },
  noteOrganization: { provider: 'anthropic', model: 'claude-haiku-4-5' },
  analytics: { provider: 'anthropic', model: 'claude-haiku-4-5' },
}
