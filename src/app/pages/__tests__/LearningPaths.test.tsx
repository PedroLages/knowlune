import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { LearningPaths } from '../LearningPaths'
import type { LearningPath, LearningPathEntry } from '@/data/types'

vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return {
    ...actual,
    useReducedMotion: () => false,
  }
})

// Mock ImportWizardDialog to verify props
let capturedWizardProps: Record<string, unknown> | null = null

vi.mock('@/app/components/figma/ImportWizardDialog', () => ({
  ImportWizardDialog: (props: Record<string, unknown>) => {
    capturedWizardProps = props
    return props.open ? (
      <div data-testid="import-wizard-mock">
        <button
          data-testid="wizard-close-mock"
          onClick={() => (props.onOpenChange as (open: boolean) => void)(false)}
        >
          Close Wizard
        </button>
      </div>
    ) : null
  },
  isImportWizardOpen: () => false,
  IMPORT_WIZARD_SET_TARGET: 'import-wizard-set-target',
}))

vi.mock('@/app/components/figma/CurriculumComposer', () => ({
  CurriculumComposer: (props: Record<string, unknown>) =>
    props.open ? <div data-testid="curriculum-composer-mock">Composer</div> : null,
}))

vi.mock('@/app/components/figma/InlineEditableField', () => ({
  InlineEditableField: (props: Record<string, unknown>) => (
    <div data-testid="inline-editable-field" data-value={props.value as string}>
      <button
        data-testid={props.as === 'textarea' ? 'edit-description-trigger' : 'edit-name-trigger'}
        onClick={() => {
          // Simulate edit + save
          ;(props.onSave as (v: string) => void)(
            props.as === 'textarea' ? 'Updated description' : 'Updated name'
          )
        }}
      >
        {(props.value as string) || 'Click to edit'}
      </button>
    </div>
  ),
}))

vi.mock('@/app/components/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state">Empty State</div>,
}))

vi.mock('@/app/components/DelayedFallback', () => ({
  DelayedFallback: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/app/components/figma/PathProgressRing', () => ({
  PathProgressRing: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="path-progress-ring">{children}</div>
  ),
}))

vi.mock('@/app/components/figma/PathCardHeader', () => ({
  PathCardHeader: () => <div data-testid="path-card-header" />,
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/motion', () => ({
  staggerContainer: {},
  fadeUp: {},
}))

vi.mock('@/app/hooks/usePathProgress', () => ({
  useMultiPathProgress: () => new Map(),
}))

vi.mock('@/ai/hooks/usePathPlacementSuggestion', () => ({
  usePathPlacementSuggestion: () => ({
    suggestion: null,
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/ai/learningPath/suggestPlacement', () => ({
  isPathPlacementAvailable: () => false,
}))

// Mutable store state
const testPath1: LearningPath = {
  id: 'path-1',
  name: 'Web Development',
  description: 'Learn web dev',
  isAIGenerated: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const testPath2: LearningPath = {
  id: 'path-2',
  name: 'Machine Learning',
  description: 'Learn ML',
  isAIGenerated: false,
  createdAt: '2026-02-01',
  updatedAt: '2026-02-01',
}

const mockLearningPathState = {
  paths: [testPath1, testPath2] as LearningPath[],
  entries: [] as LearningPathEntry[],
  loadPaths: vi.fn(),
  addCourseToPath: vi.fn(),
  createPath: vi.fn(),
  renamePath: vi.fn().mockResolvedValue(undefined),
  updateDescription: vi.fn().mockResolvedValue(undefined),
  deletePath: vi.fn(),
  deletePathWithUndo: vi.fn(),
  restorePath: vi.fn(),
}

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: Object.assign(
    (selector?: (state: typeof mockLearningPathState) => unknown) =>
      selector ? selector(mockLearningPathState) : mockLearningPathState,
    {
      getState: () => mockLearningPathState,
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    }
  ),
}))

const mockImportState = {
  importedCourses: [],
  loadImportedCourses: vi.fn(),
  loadThumbnailUrls: vi.fn(),
  thumbnailUrls: {} as Record<string, string>,
}

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector?: (state: typeof mockImportState) => unknown) =>
      selector ? selector(mockImportState) : mockImportState,
    {
      getState: () => mockImportState,
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    }
  ),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <LearningPaths />
    </MemoryRouter>
  )
}

describe('LearningPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedWizardProps = null
    mockLearningPathState.paths = [testPath1, testPath2]
    mockLearningPathState.entries = []
  })

  it('renders the page title', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Learning Paths')).toBeInTheDocument()
    })
  })

  it('renders "Create Path" button in header', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Create Path')).toBeInTheDocument()
    })
  })

  it('renders "Import Course" button in header', async () => {
    renderPage()
    await waitFor(() => {
      const buttons = screen.getAllByText('Import Course')
      expect(buttons.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('opens import wizard when header "Import Course" is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Create Path')).toBeInTheDocument()
    })

    const importButtons = screen.getAllByText('Import Course')
    await user.click(importButtons[0])

    await waitFor(() => {
      expect(screen.getByTestId('import-wizard-mock')).toBeInTheDocument()
    })
  })

  it('header "Import Course" opens wizard without targetPathId', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Create Path')).toBeInTheDocument()
    })

    const importButtons = screen.getAllByText('Import Course')
    await user.click(importButtons[0])

    await waitFor(() => {
      expect(screen.getByTestId('import-wizard-mock')).toBeInTheDocument()
    })

    expect(capturedWizardProps?.targetPathId).toBeUndefined()
  })

  it('path card dropdown has "Import Course" and "Delete" actions', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Web Development')).toBeInTheDocument()
    })

    // Open the dropdown menu for the first path card
    const menuButtons = screen.getAllByLabelText(/Actions for/)
    await user.click(menuButtons[0])

    await waitFor(() => {
      // The dropdown "Import Course" item should be visible
      const importItems = screen.getAllByText('Import Course')
      expect(importItems.length).toBeGreaterThanOrEqual(2)
    })

    // Delete item should be present
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls deletePathWithUndo when "Delete" is clicked in dropdown', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Web Development')).toBeInTheDocument()
    })

    const menuButtons = screen.getAllByLabelText(/Actions for/)
    await user.click(menuButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Delete'))

    expect(mockLearningPathState.deletePathWithUndo).toHaveBeenCalledWith('path-1')
  })

  it('inline editable field triggers renamePath on save', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByTestId('edit-name-trigger').length).toBeGreaterThanOrEqual(1)
    })

    // Click the first path's edit name trigger to simulate inline edit
    await user.click(screen.getAllByTestId('edit-name-trigger')[0])

    expect(mockLearningPathState.renamePath).toHaveBeenCalledWith('path-1', 'Updated name')
  })

  it('inline editable field triggers updateDescription on save', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByTestId('edit-description-trigger').length).toBeGreaterThanOrEqual(1)
    })

    await user.click(screen.getAllByTestId('edit-description-trigger')[0])

    expect(mockLearningPathState.updateDescription).toHaveBeenCalledWith(
      'path-1',
      'Updated description'
    )
  })
})
