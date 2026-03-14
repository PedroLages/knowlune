/**
 * Task Graph Visualizer - ASCII rendering
 *
 * Renders task graphs in user-friendly ASCII format showing:
 * - Parallel groups
 * - Sequential dependencies
 * - Task metadata (complexity, duration)
 * - Strategy recommendation
 */

import type { TaskGraph, TaskNode, DispatchStrategy } from './types'

/**
 * Task Graph Visualizer class
 *
 * Renders task graphs as ASCII art for user approval
 */
export class TaskGraphVisualizer {
  /**
   * Render task graph as ASCII art
   *
   * @param graph - Task graph to visualize
   * @returns ASCII art representation
   *
   * @example
   * const visualizer = new TaskGraphVisualizer()
   * const ascii = visualizer.renderGraph(graph)
   * console.log(ascii)
   */
  renderGraph(graph: TaskGraph): string {
    const sections: string[] = []

    // Header
    sections.push(this.renderHeader(graph))

    // Task groups (parallel + sequential)
    sections.push(this.renderTaskGroups(graph))

    // Footer with strategy and metrics
    sections.push(this.renderFooter(graph))

    return sections.join('\n\n')
  }

  /**
   * Render graph header
   *
   * @param graph - Task graph
   * @returns Header string
   */
  private renderHeader(graph: TaskGraph): string {
    const title = 'Task Graph Generated'
    const separator = '━'.repeat(50)

    return `${title}\n${separator}`
  }

  /**
   * Render task groups (parallel and sequential)
   *
   * @param graph - Task graph
   * @returns Task groups visualization
   */
  private renderTaskGroups(graph: TaskGraph): string {
    const sections: string[] = []

    // Group tasks by dependency level
    const levels = this.groupByLevel(graph)
    const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b)

    for (let i = 0; i < sortedLevels.length; i++) {
      const level = sortedLevels[i]
      const tasks = levels.get(level)!

      // Determine if this is a parallel group
      const isParallel = tasks.length > 1

      // Calculate total time for this level
      const totalTime = isParallel
        ? Math.max(...tasks.map(id => graph.nodes.get(id)!.estimatedMinutes))
        : tasks.reduce((sum, id) => sum + graph.nodes.get(id)!.estimatedMinutes, 0)

      // Group header
      const groupType = isParallel ? 'Parallel Group' : 'Sequential Group'
      const groupNumber = i + 1
      sections.push(`${groupType} ${groupNumber} (~${totalTime} min):`)

      // Render tasks in this group
      for (const taskId of tasks) {
        const node = graph.nodes.get(taskId)!
        sections.push(this.renderTaskBox(node))
      }

      // Add dependency arrow to next group (if not last)
      if (i < sortedLevels.length - 1) {
        sections.push(this.renderDependencyArrow())
      }
    }

    return sections.join('\n')
  }

  /**
   * Group tasks by dependency level
   *
   * Level 0 = no dependencies
   * Level N = max(dependency levels) + 1
   *
   * @param graph - Task graph
   * @returns Map of level to task IDs
   */
  private groupByLevel(graph: TaskGraph): Map<number, string[]> {
    const levels = new Map<number, string[]>()
    const memo = new Map<string, number>()

    const getLevel = (nodeId: string, visited: Set<string> = new Set()): number => {
      if (memo.has(nodeId)) return memo.get(nodeId)!
      if (visited.has(nodeId)) return 0 // Cycle protection

      visited.add(nodeId)

      const node = graph.nodes.get(nodeId)
      if (!node || node.dependencies.length === 0) {
        memo.set(nodeId, 0)
        return 0
      }

      let maxLevel = 0
      for (const depId of node.dependencies) {
        maxLevel = Math.max(maxLevel, getLevel(depId, new Set(visited)) + 1)
      }

      memo.set(nodeId, maxLevel)
      return maxLevel
    }

    // Calculate levels for all tasks
    for (const node of graph.nodes.values()) {
      const level = getLevel(node.id)
      if (!levels.has(level)) {
        levels.set(level, [])
      }
      levels.get(level)!.push(node.id)
    }

    return levels
  }

  /**
   * Render a single task as ASCII box
   *
   * @param node - Task node
   * @returns ASCII box representation
   */
  private renderTaskBox(node: TaskNode): string {
    const width = 45
    const topBorder = '┌' + '─'.repeat(width - 2) + '┐'
    const bottomBorder = '└' + '─'.repeat(width - 2) + '┘'

    // Task content line
    const content = this.truncate(node.content, width - 4)
    const contentLine = `│ ${this.pad(content, width - 4)} │`

    // Metadata line
    const complexity = node.complexity.toUpperCase()
    const duration = `${node.estimatedMinutes}min`
    const metadata = `[${complexity}, ${duration}]`
    const metadataLine = `│   ${this.pad(metadata, width - 6)} │`

    // Tools line (if any)
    let toolsLine = ''
    if (node.toolsNeeded.length > 0) {
      const tools = `Tools: ${node.toolsNeeded.join(', ')}`
      const truncatedTools = this.truncate(tools, width - 6)
      toolsLine = `│   ${this.pad(truncatedTools, width - 6)} │`
    }

    // Dependencies line (if any)
    let depsLine = ''
    if (node.dependencies.length > 0) {
      const deps = `Depends: ${node.dependencies.join(', ')}`
      const truncatedDeps = this.truncate(deps, width - 6)
      depsLine = `│   ${this.pad(truncatedDeps, width - 6)} │`
    }

    const lines = [topBorder, contentLine, metadataLine]
    if (toolsLine) lines.push(toolsLine)
    if (depsLine) lines.push(depsLine)
    lines.push(bottomBorder)

    return lines.join('\n')
  }

  /**
   * Render dependency arrow between groups
   *
   * @returns ASCII arrow
   */
  private renderDependencyArrow(): string {
    return '        ↓ (dependencies complete before ↓)'
  }

  /**
   * Render graph footer with strategy and metrics
   *
   * @param graph - Task graph
   * @returns Footer string
   */
  private renderFooter(graph: TaskGraph): string {
    const separator = '━'.repeat(50)
    const lines: string[] = [separator]

    // Strategy
    lines.push(`Strategy: ${this.formatStrategy(graph.recommendedStrategy)}`)

    // Team size
    const taskCount = graph.nodes.size
    lines.push(`Team size: ${taskCount} agents${taskCount > 7 ? ' (exceeds optimal 7)' : ''}`)

    // Time estimates
    const { parallelTime, sequentialTime } = this.calculateTimeEstimates(graph)
    const timeSaved = sequentialTime - parallelTime
    const percentSaved = Math.round((timeSaved / sequentialTime) * 100)

    lines.push(
      `Estimated duration: ${parallelTime} min (parallel) vs ${sequentialTime} min (sequential)`
    )
    lines.push(`Time saved: ${timeSaved} min (${percentSaved}%)`)

    // Confidence
    const avgConfidence = this.calculateAverageConfidence(graph)
    const confidenceLabel = avgConfidence >= 90 ? 'HIGH' : avgConfidence >= 70 ? 'MEDIUM' : 'LOW'
    lines.push(`Confidence: ${avgConfidence}/100 (${confidenceLabel})`)

    return lines.join('\n')
  }

  /**
   * Format dispatch strategy for display
   *
   * @param strategy - Dispatch strategy
   * @returns Formatted string
   */
  private formatStrategy(strategy: DispatchStrategy): string {
    switch (strategy) {
      case 'single-agent':
        return 'SINGLE_AGENT (1 task or deeply related)'
      case 'parallel-swarm':
        return 'PARALLEL_SWARM (2-7 independent tasks)'
      case 'sequential':
        return 'SEQUENTIAL (strong dependencies)'
      case 'hierarchical':
        return 'HIERARCHICAL (>7 tasks, subgroups needed)'
      case 'hybrid':
        return 'HYBRID (mix of parallel + sequential)'
      default:
        return strategy.toUpperCase()
    }
  }

  /**
   * Calculate time estimates for parallel vs sequential execution
   *
   * @param graph - Task graph
   * @returns Time estimates in minutes
   */
  private calculateTimeEstimates(graph: TaskGraph): {
    parallelTime: number
    sequentialTime: number
  } {
    // Sequential: sum of all tasks
    const sequentialTime = Array.from(graph.nodes.values()).reduce(
      (sum, node) => sum + node.estimatedMinutes,
      0
    )

    // Parallel: critical path length
    const parallelTime = graph.criticalPath.reduce(
      (sum, taskId) => sum + (graph.nodes.get(taskId)?.estimatedMinutes || 0),
      0
    )

    return { parallelTime, sequentialTime }
  }

  /**
   * Calculate average confidence score across all tasks
   *
   * @param graph - Task graph
   * @returns Average confidence (0-100)
   */
  private calculateAverageConfidence(graph: TaskGraph): number {
    const tasks = Array.from(graph.nodes.values())
    if (tasks.length === 0) return 0

    const totalConfidence = tasks.reduce((sum, node) => sum + node.decompositionConfidence, 0)

    return Math.round(totalConfidence / tasks.length)
  }

  /**
   * Truncate string to max length with ellipsis
   *
   * @param text - Text to truncate
   * @param maxLength - Maximum length
   * @returns Truncated text
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - 3) + '...'
  }

  /**
   * Pad string to length with spaces
   *
   * @param text - Text to pad
   * @param length - Target length
   * @returns Padded text
   */
  private pad(text: string, length: number): string {
    return text.padEnd(length, ' ')
  }

  /**
   * Render compact summary for simple graphs
   *
   * @param graph - Task graph
   * @returns Compact summary string
   */
  renderCompactSummary(graph: TaskGraph): string {
    const taskCount = graph.nodes.size
    const { parallelTime, sequentialTime } = this.calculateTimeEstimates(graph)
    const timeSaved = sequentialTime - parallelTime
    const percentSaved = Math.round((timeSaved / sequentialTime) * 100)

    return `${taskCount} tasks | ${this.formatStrategy(graph.recommendedStrategy)} | ${parallelTime}min (saves ${percentSaved}%)`
  }
}
