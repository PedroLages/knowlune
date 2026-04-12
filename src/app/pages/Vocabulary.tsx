/**
 * Vocabulary — vocabulary builder page with word list and flashcard-style review.
 *
 * Route: /vocabulary (inside Layout)
 *
 * Features:
 * - View all saved vocabulary items across books
 * - Filter by book or mastery level
 * - Edit definitions and notes inline
 * - Flashcard-style review mode (flip card to reveal definition)
 * - Mastery tracking (new → learning → familiar → mastered)
 *
 * @module Vocabulary
 * @since E109-S01
 */
import { useEffect, useState, useCallback } from 'react'
import { BookOpen, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useVocabularyStore } from '@/stores/useVocabularyStore'
import { useBookStore } from '@/stores/useBookStore'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Progress } from '@/app/components/ui/progress'
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/app/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { toast } from 'sonner'
import { VocabularyCard } from '@/app/components/vocabulary/VocabularyCard'
import { ReviewCard } from '@/app/components/vocabulary/ReviewCard'
import { EditDialog } from '@/app/components/vocabulary/EditDialog'
import type { VocabularyItem } from '@/data/types'

type ViewMode = 'list' | 'review'

export function Vocabulary() {
  const {
    items,
    isLoaded,
    loadAllItems,
    updateItem,
    deleteItem,
    addItem,
    advanceMastery,
    resetMastery,
    reviewIndex,
    setReviewIndex,
    getReviewableItems,
  } = useVocabularyStore()

  const books = useBookStore(s => s.books)
  const loadBooks = useBookStore(s => s.loadBooks)

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filterBook, setFilterBook] = useState<string>('all')
  const [filterMastery, setFilterMastery] = useState<string>('all')
  const [editingItem, setEditingItem] = useState<VocabularyItem | null>(null)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    loadAllItems()
    loadBooks()
  }, [loadAllItems, loadBooks])

  const bookTitleMap = new Map(books.map(b => [b.id, b.title]))

  const filteredItems = items.filter(item => {
    if (filterBook !== 'all' && item.bookId !== filterBook) return false
    if (filterMastery !== 'all' && item.masteryLevel !== Number(filterMastery)) return false
    return true
  })

  const reviewableItems = getReviewableItems()
  const currentReviewItem = reviewableItems[reviewIndex]

  const masteryStats = {
    total: items.length,
    mastered: items.filter(i => i.masteryLevel === 3).length,
  }
  const masteryPercent =
    masteryStats.total > 0 ? Math.round((masteryStats.mastered / masteryStats.total) * 100) : 0

  const handleEdit = useCallback((item: VocabularyItem) => {
    setEditingItem(item)
  }, [])

  const handleSaveEdit = useCallback(
    async (definition: string, note: string) => {
      if (!editingItem) return
      await updateItem(editingItem.id, { definition, note })
      setEditingItem(null)
      toast.success('Vocabulary item updated')
    },
    [editingItem, updateItem]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const itemToDelete = useVocabularyStore.getState().items.find(i => i.id === id)
      if (!itemToDelete) return
      await deleteItem(id)
      toast('Deleted', {
        description: `"${itemToDelete.word}" removed`,
        action: {
          label: 'Undo',
          onClick: () => {
            void addItem(itemToDelete)
          },
        },
        duration: 4000,
      })
    },
    [deleteItem, addItem]
  )

  const handleCorrect = useCallback(async () => {
    if (!currentReviewItem) return
    await advanceMastery(currentReviewItem.id)
    setFlipped(false)
    if (reviewIndex < reviewableItems.length - 1) {
      setReviewIndex(reviewIndex + 1)
    } else {
      setViewMode('list')
      setReviewIndex(0)
      toast.success('Review complete!')
    }
  }, [currentReviewItem, advanceMastery, reviewIndex, reviewableItems.length, setReviewIndex])

  const handleIncorrect = useCallback(async () => {
    if (!currentReviewItem) return
    await resetMastery(currentReviewItem.id)
    setFlipped(false)
    if (reviewIndex < reviewableItems.length - 1) {
      setReviewIndex(reviewIndex + 1)
    } else {
      setViewMode('list')
      setReviewIndex(0)
      toast.success('Review complete!')
    }
  }, [currentReviewItem, resetMastery, reviewIndex, reviewableItems.length, setReviewIndex])

  const startReview = useCallback(() => {
    if (reviewableItems.length === 0) {
      toast.info('All words mastered! Nothing to review.')
      return
    }
    setReviewIndex(0)
    setFlipped(false)
    setViewMode('review')
  }, [reviewableItems.length, setReviewIndex])

  if (!isLoaded) {
    return (
      <div className="space-y-6" data-testid="vocabulary-loading">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  // Review mode
  if (viewMode === 'review' && currentReviewItem) {
    return (
      <div className="space-y-6" data-testid="vocabulary-review">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setViewMode('list')
              setReviewIndex(0)
            }}
            aria-label="Back to list"
          >
            <ChevronLeft className="size-4 mr-1" />
            Back
          </Button>
          <span className="text-sm text-muted-foreground">
            {reviewIndex + 1} / {reviewableItems.length}
          </span>
        </div>

        <Progress
          value={((reviewIndex + 1) / reviewableItems.length) * 100}
          className="h-2"
          aria-label="Review progress"
        />

        <ReviewCard
          item={currentReviewItem}
          flipped={flipped}
          onFlip={() => setFlipped(!flipped)}
          onCorrect={handleCorrect}
          onIncorrect={handleIncorrect}
        />

        <div className="flex justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={reviewIndex === 0}
            onClick={() => {
              setReviewIndex(reviewIndex - 1)
              setFlipped(false)
            }}
            aria-label="Previous word"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={reviewIndex >= reviewableItems.length - 1}
            onClick={() => {
              setReviewIndex(reviewIndex + 1)
              setFlipped(false)
            }}
            aria-label="Next word"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    )
  }

  // List mode
  return (
    <div className="space-y-6" data-testid="vocabulary-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vocabulary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? 'word' : 'words'} saved
          </p>
        </div>
        <Button
          variant="brand"
          onClick={startReview}
          disabled={reviewableItems.length === 0}
          data-testid="start-review-btn"
        >
          <RotateCcw className="size-4 mr-1.5" />
          Review ({reviewableItems.length})
        </Button>
      </div>

      {/* Mastery Progress */}
      {items.length > 0 && (
        <Card data-testid="mastery-summary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Mastery Progress</span>
              <span className="text-sm text-muted-foreground">
                {masteryStats.mastered}/{masteryStats.total} mastered ({masteryPercent}%)
              </span>
            </div>
            <Progress value={masteryPercent} className="h-2" aria-label="Mastery progress" />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-3" data-testid="vocabulary-filters">
          <Select value={filterBook} onValueChange={setFilterBook}>
            <SelectTrigger className="w-[180px]" aria-label="Filter by book">
              <SelectValue placeholder="All books" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All books</SelectItem>
              {[...new Set(items.map(i => i.bookId))].map(bookId => (
                <SelectItem key={bookId} value={bookId}>
                  {bookTitleMap.get(bookId) ?? 'Unknown book'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterMastery} onValueChange={setFilterMastery}>
            <SelectTrigger className="w-[150px]" aria-label="Filter by mastery">
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="0">New</SelectItem>
              <SelectItem value="1">Learning</SelectItem>
              <SelectItem value="2">Familiar</SelectItem>
              <SelectItem value="3">Mastered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Word List */}
      {filteredItems.length === 0 ? (
        <Empty data-testid="vocabulary-empty">
          <EmptyMedia>
            <BookOpen className="size-10 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No vocabulary items yet</EmptyTitle>
            <EmptyDescription>
              Select text in the book reader and tap &ldquo;Add to Vocabulary&rdquo; to start
              building your word list.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3" data-testid="vocabulary-list">
          {filteredItems.map(item => (
            <VocabularyCard
              key={item.id}
              item={item}
              bookTitle={bookTitleMap.get(item.bookId)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {editingItem && (
        <EditDialog
          item={editingItem}
          onSave={handleSaveEdit}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}
