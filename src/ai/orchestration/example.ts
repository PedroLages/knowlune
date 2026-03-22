/**
 * Example usage of Intelligent Auto-Parallelization System
 *
 * This file demonstrates how to:
 * 1. Decompose a complex task using TaskAnalyzer
 * 2. Build a validated task graph with GraphBuilder
 * 3. Visualize the graph with TaskGraphVisualizer
 *
 * Run this example to test the Week 1-2 implementation.
 */

import { TaskAnalyzer, GraphBuilder, TaskGraphVisualizer } from './index'
import type { DecompositionRequest } from './types'

/**
 * Example: OAuth 2.0 Authentication Implementation
 *
 * This demonstrates decomposing a complex feature request
 * into atomic subtasks with dependency detection.
 */
export async function exampleOAuthDecomposition(): Promise<void> {
  console.log('=== Intelligent Auto-Parallelization Example ===\n')

  // Step 1: Create decomposition request
  const request: DecompositionRequest = {
    userTaskDescription: 'Add OAuth 2.0 authentication to the app',
    projectContext: {
      projectName: 'Knowlune',
      techStack: ['React', 'TypeScript', 'Vite'],
      recentChanges: 'Just implemented JWT authentication with refresh tokens',
    },
  }

  console.log('User Request:', request.userTaskDescription)
  console.log('Context:', request.projectContext)
  console.log('\nAnalyzing task with LLM...\n')

  // Step 2: Decompose task
  const analyzer = new TaskAnalyzer()
  let decomposition

  try {
    decomposition = await analyzer.decomposeTask(request)
    console.log('✅ Decomposition successful!')
    console.log(`   - ${decomposition.tasks.length} tasks identified`)
    console.log(`   - ${decomposition.edges.length} dependencies detected`)
    console.log(`   - Recommended strategy: ${decomposition.recommendedStrategy}`)
    console.log(`   - Overall confidence: ${decomposition.overallConfidence}/100\n`)

    // Show ambiguities (if any)
    if (decomposition.ambiguities && decomposition.ambiguities.length > 0) {
      console.log('⚠️  Ambiguities detected:')
      for (const ambiguity of decomposition.ambiguities) {
        console.log(`   - ${ambiguity}`)
      }
      console.log('')
    }
  } catch (error) {
    console.error('❌ Decomposition failed:', error)
    return
  }

  // Step 3: Build task graph
  console.log('Building task graph...\n')
  const builder = new GraphBuilder()
  let graph

  try {
    graph = builder.buildGraph(decomposition)
    console.log('✅ Graph built successfully!')
    console.log(`   - ${graph.nodes.size} nodes`)
    console.log(`   - ${graph.edges.length} edges`)
    console.log(`   - Critical path length: ${graph.criticalPath.length} tasks`)
    console.log(`   - Parallelizable sets: ${graph.parallelizableSets.length}\n`)
  } catch (error) {
    console.error('❌ Graph building failed:', error)
    return
  }

  // Step 4: Visualize graph
  console.log('Rendering graph visualization...\n')
  const visualizer = new TaskGraphVisualizer()
  const ascii = visualizer.renderGraph(graph)

  console.log(ascii)
  console.log('\n=== Example Complete ===\n')

  // Step 5: Show what would happen next
  console.log('Next steps:')
  console.log('1. User reviews graph and approves/modifies')
  console.log('2. ExecutionEngine dispatches agents in parallel')
  console.log('3. TodoWrite tracks progress in real-time')
  console.log('4. ResultAggregator consolidates outputs\n')
}

/**
 * Example with validation warnings
 *
 * Demonstrates how the system handles complex scenarios
 * that might trigger warnings or suggestions.
 */
export async function exampleWithWarnings(): Promise<void> {
  console.log('=== Example: Complex Task with Warnings ===\n')

  const request: DecompositionRequest = {
    userTaskDescription:
      'Implement comprehensive user profile system with avatar upload, bio editing, privacy settings, activity feed, followers/following, and notification preferences',
  }

  console.log('User Request:', request.userTaskDescription)
  console.log('(This is a complex task that should trigger warnings)\n')

  const analyzer = new TaskAnalyzer()
  const builder = new GraphBuilder()
  const visualizer = new TaskGraphVisualizer()

  try {
    const decomposition = await analyzer.decomposeTask(request)
    const graph = builder.buildGraph(decomposition)

    // Validate graph explicitly to show warnings
    const validation = builder.validateGraph(graph.nodes, graph.edges)

    if (validation.warnings.length > 0) {
      console.log('⚠️  Warnings:')
      for (const warning of validation.warnings) {
        console.log(`   - ${warning}`)
      }
      console.log('')
    }

    if (validation.suggestions.length > 0) {
      console.log('💡 Suggestions:')
      for (const suggestion of validation.suggestions) {
        console.log(`   - ${suggestion}`)
      }
      console.log('')
    }

    if (validation.hierarchicalGroups) {
      console.log('📊 Hierarchical grouping recommended:')
      for (let i = 0; i < validation.hierarchicalGroups.length; i++) {
        const group = validation.hierarchicalGroups[i]
        console.log(`   Team ${i + 1}: ${group.join(', ')}`)
      }
      console.log('')
    }

    console.log(visualizer.renderCompactSummary(graph))
  } catch (error) {
    console.error('❌ Example failed:', error)
  }

  console.log('\n=== Example Complete ===\n')
}

/**
 * Run all examples
 *
 * Execute this function to test the Week 1-2 implementation
 */
export async function runExamples(): Promise<void> {
  try {
    await exampleOAuthDecomposition()
    console.log('\n' + '='.repeat(60) + '\n')
    await exampleWithWarnings()
  } catch (error) {
    console.error('Examples failed:', error)
  }
}

// Allow running from command line
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples()
}
