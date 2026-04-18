import { useState, useMemo } from 'react'
import { VirtualizedGrid } from '@/app/components/VirtualizedGrid'
import { Link } from 'react-router'
import {
  ArrowDownAZ,
  BookOpen,
  Calendar,
  ExternalLink,
  Import,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Separator } from '@/app/components/ui/separator'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { CourseCard } from '@/app/components/figma/CourseCard'
import { ImportedCourseCard } from '@/app/components/figma/ImportedCourseCard'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useCourseStore } from '@/stores/useCourseStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useLazyStore } from '@/hooks/useLazyStore'
import { getMergedAuthors, getAvatarSrc, getInitials, type AuthorView } from '@/lib/authors'
import { useUnifiedSearchIndex } from '@/lib/useUnifiedSearchIndex'
import { getCourseCompletionPercent } from '@/lib/progress'
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

  // Lazy-load author store on mount (deferred — not critical for initial app load)
  useLazyStore(loadAuthors)

  // Merge pre-seeded + imported authors into unified view
  const allAuthors = useMemo(() => getMergedAuthors(storeAuthors), [storeAuthors])

  const { ready: searchReady, search: unifiedSearch } = useUnifiedSearchIndex()

  // Filter by search query. Prefer the unified index (typo-tolerant,
  // field-boosted) once it's ready; fall back to substring while booting.
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allAuthors
    if (searchReady) {
      const results = unifiedSearch(searchQuery, { types: ['author'] })
      const matchedIds = new Set(results.map(r => r.id))
      return allAuthors.filter(a => matchedIds.has(a.id))
    }
    const q = searchQuery.toLowerCase()
    return allAuthors.filter(
      a => a.name.toLowerCase().includes(q) || a.specialties.some(s => s.toLowerCase().includes(q))
    )
  }, [allAuthors, searchQuery, searchReady, unifiedSearch])

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--content-gap)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
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

      {/* Featured Author Layout (single author) */}
      {allAuthors.length === 1 && (
        <FeaturedAuthorProfile
          author={allAuthors[0]}
          onEdit={
            allAuthors[0].importedAuthor
              ? () => setEditAuthor(allAuthors[0].importedAuthor)
              : undefined
          }
          onDelete={
            allAuthors[0].importedAuthor
              ? () => setDeleteAuthor(allAuthors[0].importedAuthor)
              : undefined
          }
        />
      )}

      {/* Search & Sort Bar (multi-author only) */}
      {allAuthors.length > 1 && (
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
              className="pl-9 pr-10"
              aria-label="Search authors"
              data-testid="author-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                data-testid="author-search-clear"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
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
        <Card className="rounded-2xl border-0 shadow-sm">
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

      {/* No search results (multi-author only) */}
      {allAuthors.length > 1 && sorted.length === 0 && searchQuery.trim() && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="size-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
            <h2 className="text-lg font-semibold mb-2">No Authors Found</h2>
            <p className="text-muted-foreground max-w-md">
              No authors match &ldquo;{searchQuery}&rdquo;. Try a different search term.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Author Grid (multi-author only, virtualized) */}
      {allAuthors.length > 1 && sorted.length > 0 && (
        <VirtualizedGrid
          items={sorted}
          getItemKey={author => author.id}
          renderItem={author => (
            <AuthorCard
              author={author}
              onEdit={
                author.importedAuthor ? () => setEditAuthor(author.importedAuthor) : undefined
              }
              onDelete={
                author.importedAuthor ? () => setDeleteAuthor(author.importedAuthor) : undefined
              }
            />
          )}
          gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--content-gap)]"
          estimateRowHeight={320}
          data-testid="authors-virtual-grid"
        />
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
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-2xl"
        data-testid="author-card"
      >
        <Card className="h-full rounded-2xl border-0 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
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

/**
 * Featured author layout shown when there is exactly 1 author.
 * Displays a rich profile with larger avatar, full bio, specialties,
 * social links, and their course list — making the page feel intentional
 * rather than sparse.
 */
function FeaturedAuthorProfile({
  author,
  onEdit,
  onDelete,
}: {
  author: AuthorView
  onEdit?: () => void
  onDelete?: () => void
}) {
  const courses = useCourseStore(s => s.courses)
  const importedCourses = useCourseImportStore(s => s.importedCourses)
  const loadImportedCourses = useCourseImportStore(s => s.loadImportedCourses)
  const getAllTags = useCourseImportStore(s => s.getAllTags)

  // Lazy-load imported courses (deferred — not critical for initial app load)
  useLazyStore(loadImportedCourses)

  const authorCourses = useMemo(
    () => courses.filter(c => c.authorId === author.id),
    [courses, author.id]
  )
  const authorImportedCourses = useMemo(
    () => importedCourses.filter(c => c.authorId === author.id),
    [importedCourses, author.id]
  )
  const allTags = useMemo(() => getAllTags(), [getAllTags])
  const totalCourseCount = authorCourses.length + authorImportedCourses.length
  const socialEntries = Object.entries(author.socialLinks).filter(([, url]) => url)

  return (
    <div>
      {/* Hero Card */}
      <Card className="rounded-2xl border-0 shadow-sm mb-6" data-testid="featured-author">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Large Avatar */}
            <Avatar className="size-28 sm:size-36 shrink-0 ring-2 ring-border/50 self-center sm:self-start">
              <AvatarImage {...getAvatarSrc(author.avatar, 192)} alt={author.name} />
              <AvatarFallback className="text-3xl font-semibold bg-brand/10 text-brand">
                {getInitials(author.name)}
              </AvatarFallback>
            </Avatar>

            {/* Author Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-start gap-3 justify-center sm:justify-start">
                <h2 className="text-2xl font-bold mb-1">{author.name}</h2>
                {(onEdit || onDelete) && (
                  <div className="flex gap-1 shrink-0">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={onEdit}
                        aria-label={`Edit ${author.name}`}
                        data-testid="featured-edit-button"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={onDelete}
                        aria-label={`Delete ${author.name}`}
                        data-testid="featured-delete-button"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {author.title && <p className="text-muted-foreground mb-3">{author.title}</p>}

              {/* Featured Quote */}
              {author.featuredQuote && (
                <blockquote className="text-sm italic text-muted-foreground border-l-2 border-brand pl-3 mb-4">
                  &ldquo;{author.featuredQuote}&rdquo;
                </blockquote>
              )}

              {/* Specialty Badges */}
              {author.specialties.length > 0 && (
                <div
                  className="flex flex-wrap justify-center sm:justify-start gap-1.5 mb-4"
                  data-testid="specialty-badges"
                >
                  {author.specialties.map(specialty => (
                    <Badge key={specialty} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Social Links */}
              {socialEntries.length > 0 && (
                <div className="flex justify-center sm:justify-start gap-3">
                  {socialEntries.map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-brand hover:underline capitalize"
                      aria-label={`${platform} — ${author.name}`}
                    >
                      {platform}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
            <div className="flex flex-col items-center gap-1 rounded-xl bg-muted ring-1 ring-border/20 p-4 shadow-sm">
              <BookOpen className="size-5 text-brand mb-1" aria-hidden="true" />
              <span className="text-xl font-bold tabular-nums">{totalCourseCount}</span>
              <span className="text-xs text-muted-foreground">
                {totalCourseCount === 1 ? 'Course' : 'Courses'}
              </span>
            </div>
          </div>

          {/* View Full Profile link */}
          <div className="flex justify-end mt-4">
            <Button
              variant="brand"
              asChild
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Link to={`/authors/${author.id}`}>View Full Profile</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bio Section */}
      {author.bio && (
        <Card className="rounded-2xl border-0 shadow-sm mb-6">
          <CardContent className="p-6 sm:p-8">
            <h3 className="text-lg font-semibold mb-4">About</h3>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              {author.bio.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            {author.education && (
              <>
                <Separator className="my-5" />
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="size-4 text-brand" aria-hidden="true" />
                  <span className="font-medium">Education:</span>
                  <span className="text-muted-foreground">{author.education}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Courses Section */}
      {totalCourseCount > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Courses by {author.name}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {authorCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                variant="library"
                completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
              />
            ))}
            {authorImportedCourses.map(course => (
              <ImportedCourseCard key={course.id} course={course} allTags={allTags} />
            ))}
          </div>
        </div>
      )}

      {/* Teaser CTA */}
      <Card className="rounded-2xl border-0 shadow-sm bg-brand-soft/30">
        <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-6">
          <Import className="size-8 text-brand shrink-0" aria-hidden="true" />
          <p
            className="text-sm text-muted-foreground text-center sm:text-left"
            data-testid="authors-teaser-cta"
          >
            Authors are automatically detected when you import courses
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
