/**
 * E2E tests for Story E09B-S02: Chat-Style Q&A from Notes
 *
 * Tests chat interface, streaming responses, citations, and RAG integration.
 */

import { test, expect, type Page } from '@playwright/test'
import { seedIndexedDBStore } from '../../support/helpers/indexeddb-seed'
import { mockEmbeddingWorker } from '../../support/helpers/mock-workers'
import { mockLLMClient } from '../../support/helpers/mock-llm-client'
import { FIXED_DATE } from '../../utils/test-time'

// Test data
const mockNote1 = {
  id: 'note-1',
  courseId: 'course-1',
  videoId: 'video-1',
  content: 'React hooks are functions that let you use state and other React features.',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: ['react', 'hooks'],
}

const mockNote2 = {
  id: 'note-2',
  courseId: 'course-1',
  videoId: 'video-2',
  content: 'useState is the most commonly used hook for managing component state.',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: ['react', 'state'],
}

const mockVideo1 = {
  id: 'video-1',
  title: 'Introduction to React',
  courseId: 'course-1',
  url: 'https://example.com/video1',
  duration: 3600,
  importedAt: FIXED_DATE,
}

const mockVideo2 = {
  id: 'video-2',
  title: 'React Hooks Deep Dive',
  courseId: 'course-1',
  url: 'https://example.com/video2',
  duration: 3600,
  importedAt: FIXED_DATE,
}

const mockCourse = {
  id: 'course-1',
  name: 'React Basics',
  importedAt: FIXED_DATE,
  category: 'Programming',
  tags: ['react', 'javascript'],
  status: 'not-started' as const,
  videoCount: 2,
  pdfCount: 0,
  // @ts-expect-error - FileSystemDirectoryHandle not available in test context
  directoryHandle: null,
}

// Mock embeddings for vector search (384-dim vectors - simplified for testing)
const mockEmbedding1 = {
  noteId: 'note-1',
  embedding: new Float32Array(384).fill(0.1), // Simplified embedding vector
  model: 'all-MiniLM-L6-v2',
  createdAt: FIXED_DATE,
}

const mockEmbedding2 = {
  noteId: 'note-2',
  embedding: new Float32Array(384).fill(0.15),
  model: 'all-MiniLM-L6-v2',
  createdAt: FIXED_DATE,
}

/**
 * Seed test data (notes, videos, courses, embeddings)
 */
async function seedTestData(page: Page) {
  await seedIndexedDBStore(page, 'ElearningDB', 'notes', [mockNote1, mockNote2])
  await seedIndexedDBStore(page, 'ElearningDB', 'importedVideos', [mockVideo1, mockVideo2])
  await seedIndexedDBStore(page, 'ElearningDB', 'importedCourses', [mockCourse])
  await seedIndexedDBStore(page, 'ElearningDB', 'embeddings', [mockEmbedding1, mockEmbedding2])

  // Reload vector store to pick up seeded embeddings
  await page.waitForFunction(async () => {
    try {
      const module = await import('/src/ai/vector-store.ts')
      await module.vectorStorePersistence.loadAll()
      return true
    } catch {
      return false
    }
  })
}

/**
 * Mock AI configuration as available
 */
async function mockAIConfigured(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'ai-configuration',
      JSON.stringify({
        provider: 'openai',
        connectionStatus: 'connected',
        apiKeyEncrypted: { iv: 'mock', encryptedData: 'mock' },
        consentSettings: {
          videoSummary: true,
          noteQA: true,
          learningPath: true,
          knowledgeGaps: true,
          noteOrganization: true,
          analytics: true,
        },
      })
    )
  })
}

/**
 * Mock AI as unavailable
 */
async function mockAIUnavailable(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'ai-configuration',
      JSON.stringify({
        provider: 'openai',
        connectionStatus: 'unconfigured',
        consentSettings: {},
      })
    )
  })
}

test.describe('Chat Q&A Interface', () => {
  test('AC1: Chat panel loads with welcome message', async ({ page }) => {
    await mockAIConfigured(page)
    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    // Should show welcome message
    await expect(page.getByText(/Ask me anything/)).toBeVisible()
    await expect(page.getByPlaceholder(/Ask a question/)).toBeVisible()

    // Should show example queries
    await expect(page.getByText(/key concepts/)).toBeVisible()
  })

  test('AC6: AI unavailable shows fallback banner', async ({ page }) => {
    await mockAIUnavailable(page)
    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    // Should show warning banner
    await expect(page.getByText(/AI Provider Not Configured/)).toBeVisible()
    await expect(page.getByText(/configure an AI provider/)).toBeVisible()

    // Input should be disabled
    const input = page.getByPlaceholder(/Configure AI provider/)
    await expect(input).toBeDisabled()
  })

  test('AC2: Send query and receive response (mocked)', async ({ page }) => {
    await mockAIConfigured(page)
    await mockEmbeddingWorker(page)
    await mockLLMClient(page, {
      response:
        'React hooks are functions that let you use state and other React features in functional components. The most commonly used hooks are useState for managing state and useEffect for side effects.',
    })

    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    // Send query
    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('What are React hooks?')
    await page.click('button:has-text("Send")')

    // User message should appear
    await expect(page.getByText('What are React hooks?')).toBeVisible()

    // AI response should stream in
    await expect(page.getByText(/React hooks are functions/)).toBeVisible({ timeout: 10000 })

    // Input should be cleared
    await expect(input).toHaveValue('')
  })

  test('AC3: Citations are clickable (mocked)', async ({ page }) => {
    await mockAIConfigured(page)
    await mockEmbeddingWorker(page)
    await mockLLMClient(page, {
      response: 'React hooks are useful [1]. They simplify state management [2].',
    })

    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('What are hooks?')
    await page.click('button:has-text("Send")')

    // Wait for response
    await expect(page.getByText(/React hooks are useful/)).toBeVisible({ timeout: 10000 })

    // Verify citation buttons render
    const citation1 = page.getByRole('button', { name: /Citation 1:/ })
    const citation2 = page.getByRole('button', { name: /Citation 2:/ })

    await expect(citation1).toBeVisible()
    await expect(citation2).toBeVisible()

    // Click citation [1] and verify navigation
    await citation1.click()

    // Should navigate to /notes with video and note hash
    await page.waitForURL(/\/notes\?video=video-1#note-note-1/, { timeout: 5000 })

    // Verify note is highlighted or scrolled into view
    const highlightedNote = page.locator('[data-note-id="note-1"]')
    await expect(highlightedNote).toBeVisible()
  })

  test('AC5: Follow-up questions maintain context', async ({ page }) => {
    await mockAIConfigured(page)
    await mockEmbeddingWorker(page)
    await mockLLMClient(page, {
      response: 'React is a JavaScript library for building user interfaces.',
    })

    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    // First query
    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('What is React?')
    await page.click('button:has-text("Send")')
    await expect(page.getByText('What is React?')).toBeVisible()
    await expect(page.getByText(/JavaScript library/)).toBeVisible({ timeout: 10000 })

    // Second query (follow-up) - mock returns same response but tests history UI
    await input.fill('When were hooks added?')
    await page.click('button:has-text("Send")')

    // Both messages should be visible in conversation history
    await expect(page.getByText('What is React?')).toBeVisible()
    await expect(page.getByText('When were hooks added?')).toBeVisible()
    await expect(page.getByText(/JavaScript library/).first()).toBeVisible()
  })

  test('Input keyboard shortcuts work', async ({ page }) => {
    await mockAIConfigured(page)
    await mockEmbeddingWorker(page)
    await mockLLMClient(page, {
      response: 'Test response from AI',
    })

    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    const input = page.getByPlaceholder(/Ask a question/)

    // Type message and press Enter to send
    await input.fill('Test query')
    await input.press('Enter')

    // Message should be sent
    await expect(page.getByText('Test query')).toBeVisible()

    // Shift+Enter should add newline (not send)
    await input.fill('Line 1')
    await input.press('Shift+Enter')
    await input.type('Line 2')

    // Input should have both lines
    const value = await input.inputValue()
    expect(value).toContain('Line 1')
    expect(value).toContain('Line 2')
  })

  test('Send button is disabled while generating', async ({ page }) => {
    await mockAIConfigured(page)
    await mockEmbeddingWorker(page)
    await mockLLMClient(page, {
      response: 'Test response from the AI assistant',
      chunkDelay: 50,
      chunkSize: 10,
    })

    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    const input = page.getByPlaceholder(/Ask a question/)
    const sendButton = page.getByTestId('main-scroll-container').locator('button:has-text("Send")')

    await input.fill('Test query')
    await sendButton.click()

    // Primary test: Button should change to "Thinking..." and be disabled during generation
    await expect(page.getByText('Thinking...')).toBeVisible()
    await expect(sendButton).toBeDisabled()

    // Verify response eventually appears
    await expect(page.getByText(/Test response/)).toBeVisible({ timeout: 10000 })
  })

  test('Error handling - No relevant notes', async ({ page }) => {
    await mockAIConfigured(page)
    await mockEmbeddingWorker(page)
    await mockLLMClient(page)

    await page.goto('/')
    // Seed minimal data WITHOUT embeddings so vector search returns empty
    // (AC9 requires notes to exist so input isn't disabled)
    await seedIndexedDBStore(page, 'ElearningDB', 'notes', [mockNote1, mockNote2])
    await seedIndexedDBStore(page, 'ElearningDB', 'importedVideos', [mockVideo1, mockVideo2])
    await seedIndexedDBStore(page, 'ElearningDB', 'importedCourses', [mockCourse])
    // Do NOT seed embeddings - this makes vector search return empty results
    await page.goto('/notes/chat')

    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('Test query')
    await page.click('button:has-text("Send")')

    // Should show "no notes found" message when vector search returns empty
    await expect(page.getByText(/couldn't find any notes related to your question/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test('Mobile responsive - input layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await mockAIConfigured(page)

    // Seed sidebar as closed to prevent overlay blocking
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })

    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    // Input should be visible and properly sized
    const input = page.getByPlaceholder(/Ask a question/)
    await expect(input).toBeVisible()

    const inputBox = await input.boundingBox()
    expect(inputBox?.width).toBeGreaterThan(180) // Should take most of the mobile width
  })

  test('AC9: No notes scenario shows disabled state', async ({ page }) => {
    await mockAIConfigured(page)
    await mockEmbeddingWorker(page)

    // Navigate without seeding any notes (no seedTestData call)
    await page.goto('/notes/chat')

    // Should see "No Notes Available" warning
    await expect(page.getByText(/You haven't created any notes yet/)).toBeVisible()

    // Input should be disabled
    const input = page.getByPlaceholder(/Create notes first/)
    await expect(input).toBeVisible()
    await expect(input).toBeDisabled()

    // "Go to Notes" button should navigate
    await page.click('button:has-text("Go to Notes")')
    await expect(page).toHaveURL('/notes')
  })

  test('AC7: Privacy - no metadata in API payload', async ({ page }) => {
    // Mock AI as configured with test API key (for network interception)
    await page.addInitScript(() => {
      localStorage.setItem(
        'ai-configuration',
        JSON.stringify({
          provider: 'openai',
          connectionStatus: 'connected',
          _testApiKey: 'test-api-key-for-privacy-check', // Plaintext key for DEV mode
          consentSettings: {
            videoSummary: true,
            noteQA: true,
            learningPath: true,
            knowledgeGaps: true,
            noteOrganization: true,
            analytics: true,
          },
        })
      )
    })
    await mockEmbeddingWorker(page) // Need this for RAG to work
    // Do NOT mock LLM client - let it hit the network so we can intercept

    // Intercept OpenAI API requests and capture payload BEFORE navigation
    let capturedPayload: any = null
    await page.route('**/v1/chat/completions', async route => {
      const request = route.request()
      capturedPayload = request.postDataJSON()

      // Fulfill with mock OpenAI streaming response
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"choices":[{"delta":{"content":"React hooks"}}]}\n\ndata: [DONE]\n\n',
      })
    })

    // Now navigate and seed data
    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    // Trigger chat query
    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('What are React hooks?')
    await page.click('button:has-text("Send")')

    // Wait for response
    await expect(page.getByText(/React hooks/)).toBeVisible({ timeout: 10000 })

    // Verify privacy: payload should contain ONLY messages array
    expect(capturedPayload).toBeTruthy()
    expect(capturedPayload).toHaveProperty('messages')
    expect(capturedPayload.messages).toBeInstanceOf(Array)

    // Verify NO metadata/PII
    expect(capturedPayload).not.toHaveProperty('userId')
    expect(capturedPayload).not.toHaveProperty('noteId')
    expect(capturedPayload).not.toHaveProperty('filePath')
    expect(capturedPayload).not.toHaveProperty('videoId')
    expect(capturedPayload).not.toHaveProperty('courseId')

    // Verify messages contain only user query + system instructions (no note file paths)
    const systemMessage = capturedPayload.messages.find((m: any) => m.role === 'system')
    expect(systemMessage.content).not.toContain('filePath')
    expect(systemMessage.content).not.toContain('noteId')
  })
})

test.describe('Accessibility', () => {
  test('Chat input is keyboard accessible', async ({ page }) => {
    await mockAIConfigured(page)
    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    // Wait for page to be ready
    await page.waitForLoadState('networkidle')

    const input = page.getByPlaceholder(/Ask a question/)
    await expect(input).toBeVisible()

    // Focus input directly (testing programmatic accessibility)
    await input.focus()
    await expect(input).toBeFocused()
  })

  test('Send button has proper ARIA labels', async ({ page }) => {
    await mockAIConfigured(page)
    await page.goto('/')
    await seedTestData(page)
    await page.goto('/notes/chat')

    // Get send button from main chat area (not sidebar)
    // Using role='button' and name pattern ensures ARIA accessibility
    const sendButton = page
      .getByTestId('main-scroll-container')
      .getByRole('button', { name: /Send/ })
    await expect(sendButton).toBeVisible()

    // Verify button has accessible name containing "Send"
    const accessibleName =
      (await sendButton.getAttribute('aria-label')) || (await sendButton.textContent())
    expect(accessibleName).toMatch(/Send/)
  })
})
