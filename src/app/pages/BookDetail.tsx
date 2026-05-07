/**
 * BookDetailPage — dedicated book detail page rendered at /library/:bookId.
 *
 * Shows:
 * - BookDetailHero with cover, metadata grid, synopsis, and action buttons
 * - SimilarBooksShelf with "More like this" recommendations
 *
 * Handles:
 * - Loading skeleton while Dexie query resolves
 * - Book not found → redirect to /library with toast
 * - Empty similar books → hide section
 *
 * @since book-detail-page (2026-05-07)
 */

import { useMemo, useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { Skeleton } from '@/app/components/ui/skeleton'
import { useBookStore } from '@/stores/useBookStore'
import { findSimilarBooks } from '@/lib/similarity'
import { BookDetailHero } from '@/app/components/library/BookDetailHero'
import { SimilarBooksShelf } from '@/app/components/library/SimilarBooksShelf'
import type { Book } from '@/data/types'

function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading book details" className="space-y-6 p-6">
      <Skeleton className="h-6 w-32" />
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 md:gap-12">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-24 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function BookDetail() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTab = (location.state as { returnTab?: string } | null)?.returnTab ?? 'continue'
  const books = useBookStore(s => s.books)
  const isLoaded = useBookStore(s => s.isLoaded)
  const loadBooks = useBookStore(s => s.loadBooks)
  const [bookFound, setBookFound] = useState<boolean | null>(null)

  // Load books on mount if not already loaded
  useEffect(() => {
    if (!isLoaded) {
      loadBooks()
    }
  }, [isLoaded, loadBooks])

  // Find the book by ID
  const book = useMemo<Book | undefined>(() => {
    if (!bookId) return undefined
    return books.find(b => b.id === bookId)
  }, [books, bookId])

  // Handle book not found
  useEffect(() => {
    if (!isLoaded) return
    if (!bookId) {
      toast.error('Book not found')
      navigate('/library', { replace: true })
      return
    }
    if (!book) {
      toast.error('Book not found')
      navigate('/library', { replace: true })
      return
    }
    setBookFound(true)
  }, [isLoaded, book, bookId, navigate])

  // Compute similar books
  const similarBooks = useMemo(() => {
    if (!book) return []
    return findSimilarBooks(book, books)
  }, [book, books])

  // Show skeleton while loading
  if (!isLoaded || bookFound === null) {
    return <DetailSkeleton />
  }

  // Book not found (redirect will happen in useEffect)
  if (!book) {
    return <DetailSkeleton />
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
      <BookDetailHero book={book} returnTab={returnTab} />
      <div className="mt-10">
        <SimilarBooksShelf similarBooks={similarBooks} />
      </div>
    </div>
  )
}
