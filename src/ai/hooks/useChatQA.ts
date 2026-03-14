/**
 * useChatQA Hook
 *
 * React hook for chat-style Q&A with RAG and streaming LLM responses.
 */

import { useState, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import type { ChatMessage } from '../rag/types'
import { ragCoordinator } from '../rag/ragCoordinator'
import { promptBuilder } from '../rag/promptBuilder'
import { citationExtractor } from '../rag/citationExtractor'
import { getLLMClient } from '../llm/factory'
import { LLMError } from '../llm/types'

interface UseChatQAResult {
  /** Conversation messages */
  messages: ChatMessage[]
  /** Whether AI is generating a response */
  isGenerating: boolean
  /** Send a user message and get AI response */
  sendMessage: (query: string) => Promise<void>
  /** Clear conversation */
  clearMessages: () => void
  /** Last error if any */
  error: string | null
}

/**
 * Chat Q&A hook with RAG and streaming
 *
 * Orchestrates:
 * 1. Vector search to retrieve relevant notes
 * 2. Prompt building with retrieved context
 * 3. Streaming LLM response
 * 4. Citation extraction and mapping
 *
 * @example
 * const { messages, isGenerating, sendMessage } = useChatQA()
 * await sendMessage("What are React hooks?")
 */
export function useChatQA(): UseChatQAResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (query: string) => {
      if (isGenerating) return

      setIsGenerating(true)
      setError(null)

      // 1. Add user message
      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: query,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, userMsg])

      try {
        // 2. Retrieve context via RAG
        const context = await ragCoordinator.retrieveContext(query, 5)

        if (context.notes.length === 0) {
          // No relevant notes found
          const aiMsg: ChatMessage = {
            id: uuid(),
            role: 'assistant',
            content:
              "I couldn't find any notes related to your question. Try adding notes about this subject or rephrasing your query.",
            timestamp: Date.now(),
          }
          setMessages(prev => [...prev, aiMsg])
          return
        }

        // 3. Build prompt with context
        const llmMessages = promptBuilder.buildMessages(query, context, messages)

        // 4. Stream LLM response
        const aiMsg: ChatMessage = {
          id: uuid(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, aiMsg])

        const llmClient = await getLLMClient()
        let fullResponse = ''

        for await (const chunk of llmClient.streamCompletion(llmMessages)) {
          if (chunk.content) {
            fullResponse += chunk.content
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg && lastMsg.role === 'assistant') {
                lastMsg.content = fullResponse
              }
              return updated
            })
          }

          if (chunk.finishReason) {
            break
          }
        }

        // 5. Extract citations from final response
        const citations = citationExtractor.extract(fullResponse, context.notes)
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.citations = citations
          }
          return updated
        })
      } catch (err) {
        let errorMessage = 'Failed to process your request. Please try again.'

        if (err instanceof LLMError) {
          switch (err.code) {
            case 'TIMEOUT':
              errorMessage = 'Request timed out. Please try again.'
              break
            case 'RATE_LIMIT':
              errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.'
              break
            case 'AUTH_ERROR':
              errorMessage = 'Authentication failed. Please check your AI provider settings.'
              break
            case 'NETWORK_ERROR':
              errorMessage = 'Network error. Check your connection and try again.'
              break
            default:
              errorMessage = `AI provider error: ${err.message}`
          }
        }

        setError(errorMessage)

        // Add error message to conversation
        const errorMsg: ChatMessage = {
          id: uuid(),
          role: 'assistant',
          content: errorMessage,
          error: errorMessage,
          timestamp: Date.now(),
        }
        setMessages(prev => {
          // Replace the empty AI message with error message
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
            updated[updated.length - 1] = errorMsg
          } else {
            updated.push(errorMsg)
          }
          return updated
        })
      } finally {
        setIsGenerating(false)
      }
    },
    [isGenerating, messages]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isGenerating,
    sendMessage,
    clearMessages,
    error,
  }
}
