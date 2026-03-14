/**
 * Intelligent Auto-Parallelization Orchestration System
 *
 * LLM-powered task decomposition with automated dependency detection
 * and parallel agent dispatch.
 *
 * @module orchestration
 */

export * from './types'
export { TaskAnalyzer } from './task-analyzer'
export { GraphBuilder } from './graph-builder'
export { TaskGraphVisualizer } from './visualizer'

// Re-export key types for convenience
export type {
  TaskNode,
  TaskGraph,
  DependencyEdge,
  DecompositionRequest,
  DecompositionResponse,
  ValidationResult,
} from './types'
