/**
 * Core types for intelligent auto-parallelization system
 *
 * This module defines the data structures for LLM-powered task decomposition,
 * dependency detection, and parallel agent orchestration.
 */

// Task complexity levels
export enum TaskComplexity {
  TRIVIAL = 'trivial', // <5 min, single tool, no research
  SIMPLE = 'simple', // 5-15 min, 2-3 tools, basic research
  MODERATE = 'moderate', // 15-30 min, multiple tools, deep analysis
  COMPLEX = 'complex', // >30 min, many tools, architectural decisions
}

// Agent type selection
export enum AgentType {
  GENERAL_PURPOSE = 'general-purpose', // Full toolkit + web access
  EXPLORE = 'Explore', // Fast codebase exploration
  PLAN = 'Plan', // Architecture design
  BASH = 'Bash', // Git/CLI operations
  CUSTOM = 'custom', // User-defined agent
}

// Task execution status
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  BLOCKED = 'blocked', // Waiting on dependencies
}

// Dependency edge type
export enum DependencyType {
  SEQUENTIAL = 'sequential', // Must run after (output needed)
  CONFLICT = 'conflict', // Cannot run concurrently (shared state)
  PREREQUISITE = 'prerequisite', // Blocks execution (context needed)
  ORDERING = 'ordering', // Preferred order (not strict)
}

// Dispatch strategy
export enum DispatchStrategy {
  SINGLE_AGENT = 'single-agent', // 1 task or deeply related
  PARALLEL_SWARM = 'parallel-swarm', // 2-7 independent tasks
  SEQUENTIAL = 'sequential', // Strong dependencies
  HIERARCHICAL = 'hierarchical', // >7 tasks, create subgroups
  HYBRID = 'hybrid', // Mix of parallel + sequential
}

// Resource conflict type
export enum ConflictType {
  READ_WRITE = 'read-write', // One writes, others read (ordering needed)
  WRITE_WRITE = 'write-write', // Multiple writes (serialize required)
  EXCLUSIVE = 'exclusive', // Resource locked (dev server, DB)
  NONE = 'none', // Safe concurrent access
}

// Conflict resolution strategy
export enum ConflictResolution {
  SERIALIZE = 'serialize', // Run tasks sequentially
  QUEUE = 'queue', // First task locks, others wait
  IGNORE = 'ignore', // Conflict is false positive
  USER_DECIDE = 'user-decide', // Ambiguous - ask user
}

// Core task node interface
export interface TaskNode {
  id: string // Unique identifier (e.g., "task-001")
  content: string // Task description in imperative form
  activeForm: string // Present continuous form for TodoWrite

  // Metadata
  complexity: TaskComplexity // TRIVIAL | SIMPLE | MODERATE | COMPLEX
  estimatedMinutes: number // LLM estimate (5-60 min typical)
  agentType: AgentType // general-purpose | Explore | Plan | Bash
  toolsNeeded: string[] // ["WebSearch", "Read", "Grep", ...]

  // Dependency tracking
  dependencies: string[] // IDs of tasks that must complete first
  dependents: string[] // IDs of tasks that depend on this one

  // Resource conflict detection
  filesAccessed: string[] // Paths this task reads/writes
  resourcesNeeded: string[] // ["http://localhost:5173", "npm", ...]

  // Execution tracking
  status: TaskStatus // PENDING | IN_PROGRESS | COMPLETED | FAILED
  assignedAgent?: string // Agent ID if dispatched
  result?: TaskResult // Output after completion

  // Confidence scoring
  decompositionConfidence: number // 0-100 (LLM's confidence in this breakdown)
  dependencyConfidence: number // 0-100 (confidence in dependency edges)
}

// Dependency edge interface
export interface DependencyEdge {
  from: string // Task ID that must complete first
  to: string // Task ID that depends on 'from'
  type: DependencyType // Nature of the dependency
  confidence: number // 0-100 (LLM confidence in this edge)
  reason: string // Why this dependency exists
}

// Task graph interface
export interface TaskGraph {
  nodes: Map<string, TaskNode>
  edges: DependencyEdge[]

  // Graph metadata
  totalComplexity: number // Sum of all task complexities
  criticalPath: string[] // Longest dependency chain
  parallelizableSets: string[][] // Groups that can run concurrently

  // Orchestration hints
  recommendedStrategy: DispatchStrategy
  teamSizeLimit: number // Max agents based on research (3-7)
  hierarchicalGroups?: string[][] // Subgroups if >7 tasks
}

// Resource conflict interface
export interface ResourceConflict {
  resourceId: string // File path, URL, or resource name
  conflictingTasks: string[] // Task IDs that access this resource
  conflictType: ConflictType
  resolution: ConflictResolution
}

// Task execution result
export interface TaskResult {
  taskId: string
  success: boolean
  output: string // Summary or final result
  fullOutput?: string // Complete agent output (optional)
  durationMs: number
  costUsd: number
  tokensUsed: number
  error?: string
  artifacts?: string[] // Files created/modified
}

// Aggregated result from multiple tasks
export interface AggregatedResult {
  totalTasks: number
  completed: number
  failed: number
  totalDurationMs: number
  totalCostUsd: number
  results: TaskResult[]
  consolidatedOutput: string // Deduplicated summary
  dependencyGraph: TaskGraph // Final state
}

// LLM decomposition request
export interface DecompositionRequest {
  userTaskDescription: string
  projectContext?: {
    projectName?: string
    techStack?: string[]
    recentChanges?: string
  }
}

// LLM decomposition response
export interface DecompositionResponse {
  tasks: Omit<TaskNode, 'status' | 'dependents' | 'result'>[]
  edges: DependencyEdge[]
  recommendedStrategy: DispatchStrategy
  overallConfidence: number // 0-100
  ambiguities: string[] // Areas where user input needed
  reasoning: string // Why this decomposition was chosen
}

// Validation result
export interface ValidationResult {
  isValid: boolean
  errors: string[] // Blocking issues (circular deps, etc.)
  warnings: string[] // Non-blocking issues
  suggestions: string[] // Optimization opportunities
  hierarchicalGroups?: string[][] // Suggested team groupings if >7 tasks
}
