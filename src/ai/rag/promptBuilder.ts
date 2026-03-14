/**
 * Prompt Builder for RAG Chat Q&A
 *
 * Constructs system prompts with retrieved note context and citation instructions.
 */

import type { RetrievedContext, ChatMessage } from './types'

/** System prompt template instructing LLM on citation behavior */
const SYSTEM_PROMPT_TEMPLATE = `You are a learning assistant helping students review their course notes. Follow these rules strictly:

1. Answer ONLY using the provided note excerpts below - do not use external knowledge
2. Cite sources inline using [1], [2], etc. format when referencing specific information
3. If no relevant notes exist for the question, say "I don't have notes on this topic yet. Try adding notes about this subject or rephrasing your question."
4. Be concise (2-3 sentences) unless the student asks you to elaborate
5. Use the student's vocabulary and learning level from their notes
6. If asked to explain more, provide additional detail from the same sources

Available Notes:
{context}

Remember: Base your answer ONLY on these notes. Do not use external knowledge or make assumptions beyond what's explicitly stated in the notes.`

export class PromptBuilder {
  /**
   * Build a complete prompt for the LLM including system instructions and context
   *
   * @param _query - User's question (unused in current implementation)
   * @param context - Retrieved notes from vector search
   * @param _conversationHistory - Previous messages for multi-turn context (optional, unused in current implementation)
   * @returns Formatted system prompt with context
   */
  build(
    _query: string,
    context: RetrievedContext,
    _conversationHistory: ChatMessage[] = []
  ): string {
    const contextString = this.buildContext(context.notes)
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{context}', contextString)

    return systemPrompt
  }

  /**
   * Format retrieved notes as numbered context for the LLM
   *
   * @param notes - Retrieved notes with metadata
   * @returns Formatted context string
   *
   * @example
   * [1] video-intro.mp4 — React Basics Course
   * React is a JavaScript library for building user interfaces...
   *
   * ---
   *
   * [2] hooks-overview.mp4 — Advanced React Course
   * Hooks let you use state and other React features without writing a class...
   */
  private buildContext(notes: RetrievedContext['notes']): string {
    if (notes.length === 0) {
      return '(No relevant notes found)'
    }

    return notes
      .map(
        (note, idx) => `[${idx + 1}] ${note.videoFilename} — ${note.courseName}\n${note.content}`
      )
      .join('\n\n---\n\n')
  }

  /**
   * Build conversation messages array for LLM API
   * Formats system prompt + conversation history + current query
   *
   * @param query - Current user query
   * @param context - Retrieved context
   * @param conversationHistory - Previous messages
   * @returns Array of messages formatted for LLM API
   */
  buildMessages(
    query: string,
    context: RetrievedContext,
    conversationHistory: ChatMessage[] = []
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const systemPrompt = this.build(query, context, conversationHistory)

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Add conversation history (exclude system messages)
    conversationHistory
      .filter(msg => msg.role !== 'system')
      .forEach(msg => {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })
      })

    // Add current query
    messages.push({ role: 'user', content: query })

    return messages
  }
}

// Singleton instance
export const promptBuilder = new PromptBuilder()
