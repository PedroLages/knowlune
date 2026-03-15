/**
 * Graph Builder - Task dependency graph construction and validation
 *
 * Constructs TaskGraph from LLM decomposition output and validates:
 * - No circular dependencies
 * - Resource conflicts resolved
 * - Parallelizable task sets identified
 * - Critical path calculated
 */

import type {
  TaskNode,
  TaskGraph,
  DependencyEdge,
  DecompositionResponse,
  ValidationResult,
  TaskStatus,
} from './types'

/**
 * Graph Builder class
 *
 * Constructs and validates task dependency graphs
 */
export class GraphBuilder {
  /**
   * Build task graph from LLM decomposition response
   *
   * @param decomposition - LLM decomposition output
   * @returns Validated task graph
   * @throws {Error} If graph has critical errors (circular dependencies, etc.)
   *
   * @example
   * const builder = new GraphBuilder()
   * const graph = builder.buildGraph(decompositionResponse)
   */
  buildGraph(decomposition: DecompositionResponse): TaskGraph {
    // Convert tasks to TaskNode format
    const nodes = new Map<string, TaskNode>()

    for (const task of decomposition.tasks) {
      const node: TaskNode = {
        ...task,
        status: 'pending' as TaskStatus,
        dependents: [], // Will be populated when processing edges
      }
      nodes.set(task.id, node)
    }

    // Process edges to populate dependents
    for (const edge of decomposition.edges) {
      const fromNode = nodes.get(edge.from)
      const toNode = nodes.get(edge.to)

      if (fromNode && toNode) {
        // Add to dependent's dependencies list
        if (!toNode.dependencies.includes(edge.from)) {
          toNode.dependencies.push(edge.from)
        }

        // Add to predecessor's dependents list
        if (!fromNode.dependents.includes(edge.to)) {
          fromNode.dependents.push(edge.to)
        }
      }
    }

    // Validate graph
    const validation = this.validateGraph(nodes, decomposition.edges)
    if (!validation.isValid) {
      throw new Error(`Graph validation failed:\n${validation.errors.join('\n')}`)
    }

    // Calculate graph metadata
    const totalComplexity = this.calculateTotalComplexity(nodes)
    const criticalPath = this.findCriticalPath(nodes, decomposition.edges)
    const parallelizableSets = this.findParallelizableSets(nodes, decomposition.edges)

    // Determine hierarchical groups if needed
    const hierarchicalGroups =
      decomposition.recommendedStrategy === 'hierarchical' && validation.hierarchicalGroups
        ? validation.hierarchicalGroups
        : undefined

    const graph: TaskGraph = {
      nodes,
      edges: decomposition.edges,
      totalComplexity,
      criticalPath,
      parallelizableSets,
      recommendedStrategy: decomposition.recommendedStrategy,
      teamSizeLimit: 7, // Research-backed optimal team size
      hierarchicalGroups,
    }

    return graph
  }

  /**
   * Validate task graph for errors
   *
   * Checks for:
   * - Circular dependencies
   * - Missing dependencies
   * - Resource conflicts
   * - Team size violations
   *
   * @param nodes - Task nodes map
   * @param edges - Dependency edges
   * @returns Validation result with errors, warnings, and suggestions
   */
  validateGraph(nodes: Map<string, TaskNode>, edges: DependencyEdge[]): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check for circular dependencies
    const cycles = this.detectCycles(nodes, edges)
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        errors.push(`Circular dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`)
      }
    }

    // Check for resource conflicts
    const conflicts = this.detectResourceConflicts(nodes)
    for (const conflict of conflicts) {
      warnings.push(
        `Resource conflict: ${conflict.tasks.join(', ')} both access ${conflict.resource}`
      )
    }

    // Check team size and suggest hierarchical grouping
    const independentTasks = this.findIndependentTasks(nodes, edges)
    if (independentTasks.length > 7) {
      suggestions.push(
        `${independentTasks.length} independent tasks detected (>7 optimal). Consider hierarchical orchestration.`
      )

      // Suggest hierarchical groups
      const groups = this.suggestHierarchicalGroups(independentTasks, 7)
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        hierarchicalGroups: groups,
      }
    }

    // Check for redundant edges (A → B → C, but also A → C)
    const redundantEdges = this.findRedundantEdges(nodes, edges)
    if (redundantEdges.length > 0) {
      for (const [from, to] of redundantEdges) {
        suggestions.push(`Redundant edge: ${from} → ${to} (implied by transitive dependencies)`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    }
  }

  /**
   * Detect circular dependencies in graph
   *
   * Uses depth-first search to find cycles
   *
   * @param nodes - Task nodes map
   * @param edges - Dependency edges
   * @returns Array of cycles (each cycle is array of task IDs)
   */
  private detectCycles(nodes: Map<string, TaskNode>, _edges: DependencyEdge[]): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const currentPath: string[] = []

    // Build adjacency list
    const adjList = new Map<string, string[]>()
    for (const node of nodes.values()) {
      adjList.set(node.id, [...node.dependents])
    }

    // DFS to detect cycles
    const dfs = (nodeId: string): void => {
      visited.add(nodeId)
      recursionStack.add(nodeId)
      currentPath.push(nodeId)

      const neighbors = adjList.get(nodeId) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor)
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = currentPath.indexOf(neighbor)
          const cycle = currentPath.slice(cycleStart)
          cycles.push(cycle)
        }
      }

      recursionStack.delete(nodeId)
      currentPath.pop()
    }

    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId)
      }
    }

    return cycles
  }

  /**
   * Detect resource conflicts between tasks
   *
   * @param nodes - Task nodes map
   * @returns Array of conflicts
   */
  private detectResourceConflicts(
    nodes: Map<string, TaskNode>
  ): Array<{ resource: string; tasks: string[] }> {
    const resourceMap = new Map<string, string[]>()

    // Group tasks by resources they access
    for (const node of nodes.values()) {
      for (const file of node.filesAccessed) {
        if (!resourceMap.has(file)) {
          resourceMap.set(file, [])
        }
        resourceMap.get(file)!.push(node.id)
      }

      for (const resource of node.resourcesNeeded) {
        if (!resourceMap.has(resource)) {
          resourceMap.set(resource, [])
        }
        resourceMap.get(resource)!.push(node.id)
      }
    }

    // Find resources accessed by multiple tasks
    const conflicts: Array<{ resource: string; tasks: string[] }> = []
    for (const [resource, tasks] of resourceMap.entries()) {
      if (tasks.length > 1) {
        conflicts.push({ resource, tasks })
      }
    }

    return conflicts
  }

  /**
   * Find independent tasks (no dependencies)
   *
   * @param nodes - Task nodes map
   * @param edges - Dependency edges
   * @returns Array of task IDs with no dependencies
   */
  private findIndependentTasks(nodes: Map<string, TaskNode>, _edges: DependencyEdge[]): string[] {
    return Array.from(nodes.values())
      .filter(node => node.dependencies.length === 0)
      .map(node => node.id)
  }

  /**
   * Suggest hierarchical task grouping
   *
   * Splits tasks into balanced subgroups of max size
   *
   * @param taskIds - Task IDs to group
   * @param maxGroupSize - Maximum tasks per group (default: 7)
   * @returns Array of task ID groups
   */
  private suggestHierarchicalGroups(taskIds: string[], maxGroupSize: number = 7): string[][] {
    const groups: string[][] = []
    const numGroups = Math.ceil(taskIds.length / maxGroupSize)

    for (let i = 0; i < numGroups; i++) {
      const start = i * maxGroupSize
      const end = Math.min(start + maxGroupSize, taskIds.length)
      groups.push(taskIds.slice(start, end))
    }

    return groups
  }

  /**
   * Find redundant edges (implied by transitive dependencies)
   *
   * @param nodes - Task nodes map
   * @param edges - Dependency edges
   * @returns Array of redundant edges [from, to]
   */
  private findRedundantEdges(
    nodes: Map<string, TaskNode>,
    edges: DependencyEdge[]
  ): [string, string][] {
    const redundant: [string, string][] = []

    for (const edge of edges) {
      // Check if there's an alternate path from -> to
      if (this.hasAlternatePath(edge.from, edge.to, nodes, edges, edge)) {
        redundant.push([edge.from, edge.to])
      }
    }

    return redundant
  }

  /**
   * Check if there's an alternate path between two nodes (excluding direct edge)
   *
   * @param from - Source task ID
   * @param to - Target task ID
   * @param nodes - Task nodes map
   * @param edges - All dependency edges
   * @param excludeEdge - Edge to exclude from path search
   * @returns True if alternate path exists
   */
  private hasAlternatePath(
    from: string,
    to: string,
    _nodes: Map<string, TaskNode>,
    edges: DependencyEdge[],
    excludeEdge: DependencyEdge
  ): boolean {
    const visited = new Set<string>()
    const queue: string[] = [from]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === to) return true
      if (visited.has(current)) continue
      visited.add(current)

      // Find neighbors (excluding the direct edge)
      for (const edge of edges) {
        if (edge === excludeEdge) continue
        if (edge.from === current && !visited.has(edge.to)) {
          queue.push(edge.to)
        }
      }
    }

    return false
  }

  /**
   * Calculate total complexity score for all tasks
   *
   * @param nodes - Task nodes map
   * @returns Sum of estimated minutes
   */
  private calculateTotalComplexity(nodes: Map<string, TaskNode>): number {
    return Array.from(nodes.values()).reduce((sum, node) => sum + node.estimatedMinutes, 0)
  }

  /**
   * Find critical path (longest dependency chain)
   *
   * @param nodes - Task nodes map
   * @param edges - Dependency edges
   * @returns Array of task IDs in critical path
   */
  private findCriticalPath(nodes: Map<string, TaskNode>, _edges: DependencyEdge[]): string[] {
    const memo = new Map<string, { path: string[]; duration: number }>()

    const findLongestPath = (nodeId: string): { path: string[]; duration: number } => {
      if (memo.has(nodeId)) {
        return memo.get(nodeId)!
      }

      const node = nodes.get(nodeId)
      if (!node) {
        return { path: [], duration: 0 }
      }

      // Base case: leaf node
      if (node.dependents.length === 0) {
        const result = { path: [nodeId], duration: node.estimatedMinutes }
        memo.set(nodeId, result)
        return result
      }

      // Recursive case: find longest path through dependents
      let longestPath: string[] = []
      let longestDuration = 0

      for (const dependentId of node.dependents) {
        const { path: depPath, duration: depDuration } = findLongestPath(dependentId)
        if (depDuration > longestDuration) {
          longestPath = depPath
          longestDuration = depDuration
        }
      }

      const result = {
        path: [nodeId, ...longestPath],
        duration: node.estimatedMinutes + longestDuration,
      }
      memo.set(nodeId, result)
      return result
    }

    // Find longest path starting from root nodes (no dependencies)
    let criticalPath: string[] = []
    let criticalDuration = 0

    for (const node of nodes.values()) {
      if (node.dependencies.length === 0) {
        const { path, duration } = findLongestPath(node.id)
        if (duration > criticalDuration) {
          criticalPath = path
          criticalDuration = duration
        }
      }
    }

    return criticalPath
  }

  /**
   * Find parallelizable task sets (tasks that can run concurrently)
   *
   * @param nodes - Task nodes map
   * @param edges - Dependency edges
   * @returns Array of task ID groups that can run in parallel
   */
  private findParallelizableSets(
    nodes: Map<string, TaskNode>,
    _edges: DependencyEdge[]
  ): string[][] {
    const sets: string[][] = []

    // Group tasks by dependency level
    const levels = new Map<number, string[]>()
    const getLevel = (nodeId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(nodeId)) return 0 // Cycle protection
      visited.add(nodeId)

      const node = nodes.get(nodeId)
      if (!node || node.dependencies.length === 0) return 0

      let maxLevel = 0
      for (const depId of node.dependencies) {
        maxLevel = Math.max(maxLevel, getLevel(depId, new Set(visited)) + 1)
      }
      return maxLevel
    }

    for (const node of nodes.values()) {
      const level = getLevel(node.id)
      if (!levels.has(level)) {
        levels.set(level, [])
      }
      levels.get(level)!.push(node.id)
    }

    // Convert levels to parallelizable sets
    const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b)
    for (const level of sortedLevels) {
      const tasks = levels.get(level)!
      if (tasks.length > 1) {
        sets.push(tasks)
      }
    }

    return sets
  }
}
