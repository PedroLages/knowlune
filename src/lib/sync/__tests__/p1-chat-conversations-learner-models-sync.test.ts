/**
 * p1-chat-conversations-learner-models-sync.test.ts — E93-S08 integration test.
 *
 * Verifies the end-to-end wiring inside the app:
 *   Store action / service call → syncableWrite → Dexie write + syncQueue entry
 *
 * Covers:
 *   - chatConversations: persistConversation (add path), persistConversation (update path),
 *     clearConversation (delete path) via useTutorStore
 *   - learnerModels: getOrCreateLearnerModel (add path), updateLearnerModel (put path),
 *     replaceLearnerModelFields (put path), clearLearnerModel (delete path)
 *     via learnerModelService
 *   - Unauthenticated: Dexie writes present, zero queue entries for both tables
 *
 * @module p1-chat-conversations-learner-models-sync
 * @since E93-S08
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { vi } from 'vitest'
import type { ChatConversation, LearnerModel } from '@/data/types'

let useTutorStore: (typeof import('@/stores/useTutorStore'))['useTutorStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']
let getOrCreateLearnerModel: (typeof import('@/ai/tutor/learnerModelService'))['getOrCreateLearnerModel']
let updateLearnerModel: (typeof import('@/ai/tutor/learnerModelService'))['updateLearnerModel']
let replaceLearnerModelFields: (typeof import('@/ai/tutor/learnerModelService'))['replaceLearnerModelFields']
let clearLearnerModel: (typeof import('@/ai/tutor/learnerModelService'))['clearLearnerModel']

const TEST_USER_ID = 'user-e93-s08'
const TEST_COURSE_ID = 'course-e93-s08'
const TEST_VIDEO_ID = 'video-e93-s08'

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

/** Seed a ChatConversation directly in Dexie for update-path tests */
async function seedConversation(overrides?: Partial<ChatConversation>): Promise<ChatConversation> {
  const now = Date.now()
  const conv: ChatConversation = {
    id: crypto.randomUUID(),
    courseId: TEST_COURSE_ID,
    videoId: TEST_VIDEO_ID,
    mode: 'socratic',
    hintLevel: 0,
    messages: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  await db.chatConversations.add(conv)
  return conv
}

/** Seed a LearnerModel directly in Dexie for update/delete-path tests */
async function seedLearnerModel(overrides?: Partial<LearnerModel>): Promise<LearnerModel> {
  const now = new Date().toISOString()
  const model: LearnerModel = {
    id: crypto.randomUUID(),
    courseId: TEST_COURSE_ID,
    vocabularyLevel: 'beginner',
    strengths: [],
    misconceptions: [],
    topicsExplored: [],
    preferredMode: 'socratic',
    lastSessionSummary: '',
    quizStats: { totalQuestions: 0, correctAnswers: 0, weakTopics: [] },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  await db.learnerModels.add(model)
  return model
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  // Seed a signed-in user so syncableWrite enqueues upload entries.
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 'e93-s08-test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const tutorMod = await import('@/stores/useTutorStore')
  useTutorStore = tutorMod.useTutorStore

  const dbMod = await import('@/db')
  db = dbMod.db

  const lmMod = await import('@/ai/tutor/learnerModelService')
  getOrCreateLearnerModel = lmMod.getOrCreateLearnerModel
  updateLearnerModel = lmMod.updateLearnerModel
  replaceLearnerModelFields = lmMod.replaceLearnerModelFields
  clearLearnerModel = lmMod.clearLearnerModel
})

// ---------------------------------------------------------------------------
// chatConversations sync wiring
// ---------------------------------------------------------------------------

describe('E93-S08 sync wiring — chatConversations', () => {
  it('persistConversation (add path) authenticated → syncQueue has add entry with status pending', async () => {
    const store = useTutorStore.getState()
    store.setLessonContext(TEST_COURSE_ID, TEST_VIDEO_ID)
    // Add a message so persistConversation doesn't early-return on empty messages
    store.addMessage({ id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now(), mode: 'socratic' })

    await useTutorStore.getState().persistConversation()

    const entries = await getQueueEntries('chatConversations')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const addEntry = entries.find(e => e.operation === 'add')
    expect(addEntry).toBeDefined()
    expect(addEntry!.status).toBe('pending')
  })

  it('persistConversation (update path, existing conversation) authenticated → syncQueue has put entry', async () => {
    const store = useTutorStore.getState()
    store.setLessonContext(TEST_COURSE_ID, TEST_VIDEO_ID)
    store.addMessage({ id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now(), mode: 'socratic' })

    // First persist creates the conversation (add path)
    await useTutorStore.getState().persistConversation()

    // Clear queue to isolate the update entry
    await db.syncQueue.clear()

    // Add another message so update path has something new
    useTutorStore.getState().addMessage({ id: 'msg-2', role: 'assistant', content: 'Hi there', timestamp: Date.now(), mode: 'socratic' })

    // Second persist — conversationId is now set, so this is the update path
    await useTutorStore.getState().persistConversation()

    const entries = await getQueueEntries('chatConversations')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
  })

  it('clearConversation authenticated → syncQueue has delete entry; Dexie record absent', async () => {
    // Seed a conversation and set it as the active conversationId
    const conv = await seedConversation()
    useTutorStore.setState({ conversationId: conv.id })

    useTutorStore.getState().clearConversation()
    // clearConversation is fire-and-forget — wait for async delete to settle
    await new Promise(resolve => setTimeout(resolve, 50))

    const stored = await db.chatConversations.get(conv.id)
    expect(stored).toBeUndefined()

    const entries = await getQueueEntries('chatConversations')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
  })

  it('persistConversation — early return when _courseId or _videoId is null → no syncQueue entries', async () => {
    const store = useTutorStore.getState()
    // Do NOT call setLessonContext — _courseId and _videoId remain null
    store.addMessage({ id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now(), mode: 'socratic' })

    await useTutorStore.getState().persistConversation()

    const entries = await getQueueEntries('chatConversations')
    expect(entries).toHaveLength(0)
  })

  it('persistConversation update path — get returns undefined → early return, no syncQueue entry', async () => {
    const store = useTutorStore.getState()
    store.setLessonContext(TEST_COURSE_ID, TEST_VIDEO_ID)
    store.addMessage({ id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now(), mode: 'socratic' })

    // Set a conversationId that does NOT exist in Dexie
    useTutorStore.setState({ conversationId: 'nonexistent-id' })

    await useTutorStore.getState().persistConversation()

    const entries = await getQueueEntries('chatConversations')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// chatConversations — unauthenticated writes
// ---------------------------------------------------------------------------

describe('E93-S08 sync wiring — chatConversations unauthenticated', () => {
  it('persistConversation (add path) unauthenticated → Dexie record present, zero chatConversations queue entries', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    const store = useTutorStore.getState()
    store.setLessonContext(TEST_COURSE_ID, TEST_VIDEO_ID)
    store.addMessage({ id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now(), mode: 'socratic' })

    await useTutorStore.getState().persistConversation()

    const convs = await db.chatConversations.toArray()
    expect(convs.length).toBeGreaterThanOrEqual(1)

    const entries = await getQueueEntries('chatConversations')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// learnerModels sync wiring
// ---------------------------------------------------------------------------

describe('E93-S08 sync wiring — learnerModels', () => {
  it('getOrCreateLearnerModel (create path) authenticated → syncQueue has add entry with status pending', async () => {
    await getOrCreateLearnerModel(TEST_COURSE_ID)

    const entries = await getQueueEntries('learnerModels')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const addEntry = entries.find(e => e.operation === 'add')
    expect(addEntry).toBeDefined()
    expect(addEntry!.status).toBe('pending')
  })

  it('updateLearnerModel authenticated → syncQueue has put entry with status pending', async () => {
    await seedLearnerModel()

    await db.syncQueue.clear()

    await updateLearnerModel(TEST_COURSE_ID, { vocabularyLevel: 'intermediate' })

    const entries = await getQueueEntries('learnerModels')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
  })

  it('replaceLearnerModelFields authenticated → syncQueue has put entry with status pending', async () => {
    await seedLearnerModel()

    await db.syncQueue.clear()

    await replaceLearnerModelFields(TEST_COURSE_ID, { strengths: [] })

    const entries = await getQueueEntries('learnerModels')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
  })

  it('clearLearnerModel authenticated → Dexie record absent; syncQueue has delete entry', async () => {
    const model = await seedLearnerModel()

    await db.syncQueue.clear()

    await clearLearnerModel(TEST_COURSE_ID)

    const stored = await db.learnerModels.get(model.id)
    expect(stored).toBeUndefined()

    const entries = await getQueueEntries('learnerModels')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
  })

  it('updateLearnerModel when no model exists for courseId → returns null, no syncQueue entry', async () => {
    const result = await updateLearnerModel('nonexistent-course', { vocabularyLevel: 'advanced' })
    expect(result).toBeNull()

    const entries = await getQueueEntries('learnerModels')
    expect(entries).toHaveLength(0)
  })

  it('clearLearnerModel when no model exists → no Dexie write, no syncQueue entry, no error', async () => {
    await expect(clearLearnerModel('nonexistent-course')).resolves.toBeUndefined()

    const entries = await getQueueEntries('learnerModels')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// learnerModels — unauthenticated writes
// ---------------------------------------------------------------------------

describe('E93-S08 sync wiring — learnerModels unauthenticated', () => {
  it('getOrCreateLearnerModel unauthenticated → Dexie record present, zero learnerModels queue entries', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    await getOrCreateLearnerModel(TEST_COURSE_ID)

    const models = await db.learnerModels.toArray()
    expect(models.length).toBeGreaterThanOrEqual(1)

    const entries = await getQueueEntries('learnerModels')
    expect(entries).toHaveLength(0)
  })

  it('updateLearnerModel unauthenticated → Dexie record updated, zero learnerModels queue entries', async () => {
    // Seed directly first (bypassing auth check — we test auth on the service call)
    await seedLearnerModel()
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    await updateLearnerModel(TEST_COURSE_ID, { vocabularyLevel: 'advanced' })

    const model = await db.learnerModels.where('courseId').equals(TEST_COURSE_ID).first()
    expect(model).toBeDefined()
    // Dexie is updated (syncableWrite still writes locally)
    expect(model!.vocabularyLevel).toBe('advanced')

    const entries = await getQueueEntries('learnerModels')
    expect(entries).toHaveLength(0)
  })
})
