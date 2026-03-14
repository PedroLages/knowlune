/**
 * Task Analyzer - LLM-powered task decomposition
 *
 * Analyzes complex user tasks and decomposes them into atomic subtasks
 * with dependency detection and confidence scoring.
 */

import { getLLMClient } from '../llm/factory'
import type { LLMMessage } from '../llm/types'
import type {
  DecompositionRequest,
  DecompositionResponse,
  TaskNode,
  DependencyEdge,
  DispatchStrategy,
} from './types'

/**
 * Task decomposition prompt template
 *
 * Instructs the LLM to break down complex tasks into atomic subtasks
 * with dependency analysis and confidence scoring.
 */
const DECOMPOSITION_PROMPT_TEMPLATE = `You are a task decomposition specialist for Claude Code. Analyze this complex task and break it down into atomic subtasks.

## Task Description
{task_description}

{project_context}

## Your Analysis Must Include

1. **Subtask Breakdown** (3-15 tasks typical):
   - Each task must be atomic (completable by one agent in <30 min)
   - Use imperative form: "Research X", "Implement Y", "Test Z"
   - Estimate complexity: TRIVIAL | SIMPLE | MODERATE | COMPLEX
   - Estimate duration: 5-60 minutes per task
   - Suggest agent type: general-purpose | Explore | Plan | Bash
   - List tools needed: ["WebSearch", "Read", "Grep", ...]
   - List files accessed: ["src/auth/*.ts", ...] (be specific when possible)

2. **Dependency Detection**:
   - For each task, identify which OTHER tasks must complete first
   - Classify dependency type: SEQUENTIAL | CONFLICT | PREREQUISITE | ORDERING
   - Explain WHY the dependency exists (output needed? shared state? context?)
   - Score confidence (0-100) for each dependency edge

3. **Resource Conflict Analysis**:
   - Which files/paths will each task read or write?
   - Which shared resources are needed? (localhost:5173, npm, git, etc.)
   - Mark potential conflicts between tasks

4. **Confidence Scoring**:
   - Rate your confidence (0-100) in this decomposition
   - Highlight ambiguous areas where user input is needed
   - Flag tasks that might be too complex (need further breakdown)

## Output Format (JSON)

Respond ONLY with valid JSON matching this structure:

\`\`\`json
{
  "tasks": [
    {
      "id": "task-001",
      "content": "Research OAuth 2.0 best practices",
      "activeForm": "Researching OAuth 2.0 best practices",
      "complexity": "SIMPLE",
      "estimatedMinutes": 15,
      "agentType": "general-purpose",
      "toolsNeeded": ["WebSearch", "WebFetch"],
      "filesAccessed": [],
      "resourcesNeeded": [],
      "dependencies": [],
      "decompositionConfidence": 95,
      "dependencyConfidence": 90
    }
  ],
  "edges": [
    {
      "from": "task-001",
      "to": "task-003",
      "type": "PREREQUISITE",
      "confidence": 90,
      "reason": "Design requires understanding current best practices"
    }
  ],
  "recommendedStrategy": "PARALLEL_SWARM",
  "overallConfidence": 88,
  "ambiguities": [
    "Task-003 might be too complex - could split into 'design data flow' + 'design API integration'"
  ],
  "reasoning": "Tasks 1-2 are fully independent, then task-3 consolidates. Total 3 agents within team size limit."
}
\`\`\`

## Critical Rules

- Never create tasks that require >30 minutes (split further)
- Always prefer smaller, focused tasks over monolithic ones
- Mark CONFLICT dependencies when tasks modify the same files
- If unsure about dependencies, mark as ORDERING (soft preference) not SEQUENTIAL (hard block)
- Complexity TRIVIAL = single tool, no thinking; COMPLEX = multiple decisions, research
- Ensure all task IDs are referenced correctly in dependencies and edges
- Output ONLY valid JSON - no markdown, no explanations, just the JSON object`

/**
 * Task Analyzer class
 *
 * Uses LLM to decompose complex tasks into atomic subtasks with dependencies
 */
export class TaskAnalyzer {
  /**
   * Decompose a complex task into atomic subtasks
   *
   * @param request - Decomposition request with task description and optional context
   * @returns Promise resolving to decomposition response with tasks and dependencies
   * @throws {Error} If LLM returns invalid JSON or decomposition fails
   *
   * @example
   * const analyzer = new TaskAnalyzer()
   * const result = await analyzer.decomposeTask({
   *   userTaskDescription: "Add OAuth 2.0 authentication to the app",
   *   projectContext: {
   *     projectName: "LevelUp",
   *     techStack: ["React", "TypeScript", "Vite"],
   *     recentChanges: "Just added JWT authentication"
   *   }
   * })
   */
  async decomposeTask(request: DecompositionRequest): Promise<DecompositionResponse> {
    const prompt = this.formatPrompt(request)
    const llmClient = await getLLMClient()

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are a task decomposition specialist. Respond only with valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]

    // Collect streaming response
    let fullResponse = ''
    for await (const chunk of llmClient.streamCompletion(messages)) {
      fullResponse += chunk.content
    }

    // Parse JSON response
    try {
      const parsed = this.parseResponse(fullResponse)
      this.validateResponse(parsed)
      return parsed
    } catch (error) {
      throw new Error(
        `Failed to parse LLM decomposition response: ${error instanceof Error ? error.message : 'Unknown error'}\n\nResponse:\n${fullResponse}`
      )
    }
  }

  /**
   * Format decomposition prompt with task description and context
   *
   * @param request - Decomposition request
   * @returns Formatted prompt string
   */
  private formatPrompt(request: DecompositionRequest): string {
    let projectContext = ''

    if (request.projectContext) {
      const { projectName, techStack, recentChanges } = request.projectContext

      const contextParts: string[] = []
      if (projectName) contextParts.push(`Project: ${projectName}`)
      if (techStack && techStack.length > 0) {
        contextParts.push(`Tech stack: ${techStack.join(', ')}`)
      }
      if (recentChanges) contextParts.push(`Recent changes: ${recentChanges}`)

      if (contextParts.length > 0) {
        projectContext = `\n## Codebase Context\n${contextParts.join('\n')}\n`
      }
    }

    return DECOMPOSITION_PROMPT_TEMPLATE.replace('{task_description}', request.userTaskDescription)
      .replace('{project_context}', projectContext)
      .trim()
  }

  /**
   * Parse LLM response into DecompositionResponse
   *
   * Handles markdown code blocks and extracts JSON
   *
   * @param response - Raw LLM response
   * @returns Parsed decomposition response
   */
  private parseResponse(response: string): DecompositionResponse {
    // Remove markdown code blocks if present
    let jsonText = response.trim()

    // Remove ```json and ``` markers
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }

    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }

    jsonText = jsonText.trim()

    const parsed = JSON.parse(jsonText)

    return parsed as DecompositionResponse
  }

  /**
   * Validate decomposition response structure
   *
   * @param response - Parsed response
   * @throws {Error} If response is invalid
   */
  private validateResponse(response: DecompositionResponse): void {
    if (!response.tasks || !Array.isArray(response.tasks)) {
      throw new Error('Response must include "tasks" array')
    }

    if (response.tasks.length < 1 || response.tasks.length > 15) {
      throw new Error(`Expected 1-15 tasks, got ${response.tasks.length}`)
    }

    if (!response.edges || !Array.isArray(response.edges)) {
      throw new Error('Response must include "edges" array')
    }

    if (!response.recommendedStrategy) {
      throw new Error('Response must include "recommendedStrategy"')
    }

    if (typeof response.overallConfidence !== 'number') {
      throw new Error('Response must include "overallConfidence" number')
    }

    // Validate each task has required fields
    for (const task of response.tasks) {
      if (!task.id || !task.content || !task.activeForm) {
        throw new Error(`Task missing required fields: ${JSON.stringify(task)}`)
      }

      if (!task.complexity || !task.agentType) {
        throw new Error(`Task ${task.id} missing complexity or agentType`)
      }

      if (typeof task.estimatedMinutes !== 'number') {
        throw new Error(`Task ${task.id} missing estimatedMinutes`)
      }
    }

    // Validate dependency edges reference valid task IDs
    const taskIds = new Set(response.tasks.map(t => t.id))
    for (const edge of response.edges) {
      if (!taskIds.has(edge.from)) {
        throw new Error(`Edge references invalid task ID: ${edge.from}`)
      }
      if (!taskIds.has(edge.to)) {
        throw new Error(`Edge references invalid task ID: ${edge.to}`)
      }
    }
  }
}
