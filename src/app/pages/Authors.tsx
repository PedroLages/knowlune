import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowDownAZ, BookOpen, Calendar, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { getMergedAuthors, getAvatarSrc, getInitials, type AuthorView } from '@/lib/authors'
import { AuthorFormDialog } from '@/app/components/authors/AuthorFormDialog'
import { DeleteAuthorDialog } from '@/app/components/authors/DeleteAuthorDialog'
import type { ImportedAuthor } from '@/data/types'

type SortMode = 'alphabetical' | 'most-courses' | 'recently-added'

export function Authors() {
  const { authors: storeAuthors, isLoaded, isLoading, loadAuthors } = useAuthorStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editAuthor, setEditAuthor] = useState<ImportedAuthor | undefined>()
  const [deleteAuthor, setDeleteAuthor] = useState<ImportedAuthor | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical')

  useEffect(() => {
    loadAuthors()
  }, [loadAuthors])

  // Merge pre-seeded + imported authors into unified view
  const allAuthors = useMemo(() => getMergedAuthors(storeAuthors), [storeAuthors])

  // Filter by search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allAuthors
    const q = searchQuery.toLowerCase()
    return allAuthors.filter(
      a => a.name.toLowerCase().includes(q) || a.specialties.some(s => s.toLowerCase().includes(q))
    )
  }, [allAuthors, searchQuery])

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered]
    switch (sortMode) {
      case 'alphabetical':
        return copy.sort((a, b) => a.name.localeCompare(b.name))
      case 'most-courses':
        return copy.sort((a, b) => b.courseCount - a.courseCount || a.name.localeCompare(b.name))
      case 'recently-added':
        return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      default:
        return copy
    }
  }, [filtered, sortMode])

  if (isLoading && !isLoaded) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        {/* Search/sort skeleton */}
        <div className="mb-6 flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-[24px]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Our Authors</h1>
          <p className="text-muted-foreground">
            {allAuthors.length === 0
              ? 'No authors yet. Add your first author to get started.'
              : allAuthors.length === 1
                ? 'Meet the expert behind your learning journey'
                : `Meet the ${allAuthors.length} experts behind your learning journey`}
          </p>
        </div>
        <Button
          variant="brand"
          className="shrink-0 gap-1.5"
          onClick={() => setCreateOpen(true)}
          data-testid="add-author-button"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Author
        </Button>
      </div>

      {/* Search & Sort Bar */}
      {allAuthors.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search authors by name or specialty..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search authors"
              data-testid="author-search-input"
            />
          </div>
          <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
            <SelectTrigger
              className="w-full sm:w-48"
              aria-label="Sort authors"
              data-testid="author-sort-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alphabetical">
                <span className="flex items-center gap-2">
                  <ArrowDownAZ className="size-4" aria-hidden="true" />
                  Alphabetical
                </span>
              </SelectItem>
              <SelectItem value="most-courses">
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4" aria-hidden="true" />
                  Most Courses
                </span>
              </SelectItem>
              <SelectItem value="recently-added">
                <span className="flex items-center gap-2">
                  <Calendar className="size-4" aria-hidden="true" />
                  Recently Added
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Empty State */}
      {isLoaded && allAuthors.length === 0 && (
        <Card className="rounded-[24px] border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="size-16 text-muted-foreground/50 mb-4" aria-hidden="true" />
            <h2 className="text-lg font-semibold mb-2">No Authors Yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Add authors to your library to organize and attribute your course content.
            </p>
            <Button
              variant="brand"
              className="gap-1.5"
              onClick={() => setCreateOpen(true)}
              data-testid="empty-add-author-button"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Your First Author
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No search results */}
      {allAuthors.length > 0 && sorted.length === 0 && searchQuery.trim() && (
        <Card className="rounded-[24px] border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="size-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
            <h2 className="text-lg font-semibold mb-2">No Authors Found</h2>
            <p className="text-muted-foreground max-w-md">
              No authors match &ldquo;{searchQuery}&rdquo;. Try a different search term.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Author Grid */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map(author => (
            <AuthorCard
              key={author.id}
              author={author}
              onEdit={
                author.importedAuthor ? () => setEditAuthor(author.importedAuthor) : undefined
              }
              onDelete={
                author.importedAuthor ? () => setDeleteAuthor(author.importedAuthor) : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <AuthorFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit Dialog */}
      <AuthorFormDialog
        open={!!editAuthor}
        onOpenChange={v => {
          if (!v) setEditAuthor(undefined)
        }}
        author={editAuthor}
      />

      {/* Delete Dialog */}
      {deleteAuthor && (
        <DeleteAuthorDialog
          open={!!deleteAuthor}
          onOpenChange={v => {
            if (!v) setDeleteAuthor(undefined)
          }}
          author={deleteAuthor}
        />
      )}
    </div>
  )
}

function AuthorCard({
  author,
  onEdit,
  onDelete,
}: {
  author: AuthorView
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="group relative">
      <Link
        to={`/authors/${author.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-[24px]"
        data-testid="author-card"
      >
        <Card className="h-full rounded-[24px] border-0 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
          <CardContent className="flex flex-col items-center text-center p-6 pt-8">
            {/* Avatar */}
            <Avatar className="size-24 mb-4 ring-2 ring-border/50 group-hover:ring-brand/30 transition-all">
              <AvatarImage {...getAvatarSrc(author.avatar, 96)} alt={author.name} />
              <AvatarFallback className="text-lg font-semibold bg-brand/10 text-brand">
                {getInitials(author.name)}
              </AvatarFallback>
            </Avatar>

            {/* Name & Title */}
            <h2 className="text-lg font-semibold group-hover:text-brand transition-colors">
              {author.name}
            </h2>
            {author.title && <p className="text-sm text-muted-foreground mt-1">{author.title}</p>}

            {/* Bio snippet for authors without a title */}
            {!author.title && author.bio && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-[260px]">
                {author.shortBio}
              </p>
            )}

            {/* Specialty Badges */}
            {author.specialties.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-3 mb-5">
                {author.specialties.slice(0, 3).map(specialty => (
                  <Badge key={specialty} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {author.specialties.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{author.specialties.length - 3}
                  </Badge>
                )}
              </div>
            )}
            {author.specialties.length === 0 && <div className="mb-5 mt-3" />}

            {/* Stats Row */}
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5" data-testid="author-course-count">
                <BookOpen className="size-4 text-brand" aria-hidden="true" />
                <span className="tabular-nums font-medium">{author.courseCount}</span>
                <span className="hidden sm:inline">
                  {author.courseCount === 1 ? 'course' : 'courses'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Action Buttons (hover overlay) — only for editable (imported) authors */}
      {(onEdit || onDelete) && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1 z-10">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-card"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                onEdit()
              }}
              aria-label={`Edit ${author.name}`}
              data-testid="edit-author-button"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-destructive/10 hover:text-destructive"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                onDelete()
              }}
              aria-label={`Delete ${author.name}`}
              data-testid="delete-author-button"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
