/**
 * useChatQA Hook
 *
 * React hook for chat-style Q&A with RAG and streaming LLM responses.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import type { ChatMessage } from '../rag/types'
import { ragCoordinator } from '../rag/ragCoordinator'
import { promptBuilder } from '../rag/promptBuilder'
import { citationExtractor } from '../rag/citationExtractor'
import { assertAIFeatureConsent, getLLMClient } from '../llm/factory'
import { formatNoteQAError } from '@/lib/noteQAErrors'
import { useAuthStore } from '@/stores/useAuthStore'
import { useProviderReconsent, type UseProviderReconsentResult } from '@/ai/hooks/useProviderReconsent'

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
  /** Spread onto `<ProviderReconsentModal />` (E119-S09 re-consent) */
  providerReconsentModalProps: UseProviderReconsentResult['modalProps']
  /** When set, show `AIConsentDeclinedBanner` with this provider id */
  declinedProvider: string | null
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
  const userId = useAuthStore(s => s.user?.id)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastQueryRef = useRef('')
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const retryPipelineRef = useRef<() => Promise<void>>(async () => {})
  const reconsentOptions = useMemo(
    () => ({
      onRetry: () => void retryPipelineRef.current(),
    }),
    []
  )
  const { handleAIError, declinedProvider, modalProps } = useProviderReconsent(userId, reconsentOptions)

  const runChatPipeline = useCallback(async (query: string) => {
    const resolved = await assertAIFeatureConsent('noteQA')

    const context = await ragCoordinator.retrieveContext(query, 5)

    if (context.notes.length === 0) {
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

    const priorMessages = messagesRef.current
    const llmMessages = promptBuilder.buildMessages(query, context, priorMessages)

    const aiMsg: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, aiMsg])

    const llmClient = await getLLMClient('noteQA', { resolved })
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

    const citations = citationExtractor.extract(fullResponse, context.notes)
    setMessages(prev => {
      const updated = [...prev]
      const lastMsg = updated[updated.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.citations = citations
      }
      return updated
    })
  }, [])

  const appendErrorAssistant = useCallback((errorMessage: string) => {
    setError(errorMessage)
    const errorMsg: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: errorMessage,
      error: errorMessage,
      timestamp: Date.now(),
    }
    setMessages(prev => {
      const updated = [...prev]
      const lastMsg = updated[updated.length - 1]
      if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
        updated[updated.length - 1] = errorMsg
      } else {
        updated.push(errorMsg)
      }
      return updated
    })
  }, [])

  const sendMessage = useCallback(
    async (query: string) => {
      if (isGenerating) return

      lastQueryRef.current = query
      setIsGenerating(true)
      setError(null)

      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: query,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, userMsg])

      try {
        await runChatPipeline(query)
      } catch (err) {
        if (handleAIError(err)) {
          return
        }
        appendErrorAssistant(formatNoteQAError(err))
      } finally {
        setIsGenerating(false)
      }
    },
    [isGenerating, runChatPipeline, handleAIError, appendErrorAssistant]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  // Satisfy exhaustive-deps: retry ref reads latest handlers
  useEffect(() => {
    retryPipelineRef.current = async () => {
      const query = lastQueryRef.current
      if (!query) return
      setIsGenerating(true)
      setError(null)
      try {
        await runChatPipeline(query)
      } catch (err) {
        if (handleAIError(err)) {
          return
        }
        appendErrorAssistant(formatNoteQAError(err))
      } finally {
        setIsGenerating(false)
      }
    }
  }, [runChatPipeline, handleAIError, appendErrorAssistant])

  return {
    messages,
    isGenerating,
    sendMessage,
    clearMessages,
    error,
    providerReconsentModalProps: modalProps,
    declinedProvider,
  }
}
