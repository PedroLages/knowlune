import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { BookOpen, Clock, GraduationCap, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Skeleton } from '@/app/components/ui/skeleton'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { getAuthorStats, getAvatarSrc } from '@/lib/authors'
import { AuthorFormDialog } from '@/app/components/authors/AuthorFormDialog'
import { DeleteAuthorDialog } from '@/app/components/authors/DeleteAuthorDialog'
import type { Author } from '@/data/types'

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

export function Authors() {
  const { authors, isLoaded, isLoading, loadAuthors } = useAuthorStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editAuthor, setEditAuthor] = useState<Author | undefined>()
  const [deleteAuthor, setDeleteAuthor] = useState<Author | undefined>()

  useEffect(() => {
    loadAuthors()
  }, [loadAuthors])

  if (isLoading && !isLoaded) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-[24px]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Our Authors</h1>
          <p className="text-muted-foreground">
            {authors.length === 0
              ? 'No authors yet. Add your first author to get started.'
              : authors.length === 1
                ? 'Meet the expert behind your learning journey'
                : `Meet the ${authors.length} experts behind your learning journey`}
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

      {/* Empty State */}
      {isLoaded && authors.length === 0 && (
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

      {/* Author Grid */}
      {authors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {authors.map(author => {
            const stats = getAuthorStats(author)
            return (
              <div key={author.id} className="group relative">
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
                      <p className="text-sm text-muted-foreground mt-1 mb-4">{author.title}</p>

                      {/* Specialty Badges */}
                      <div className="flex flex-wrap justify-center gap-1.5 mb-5">
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

                      {/* Stats Row */}
                      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="size-4 text-brand" aria-hidden="true" />
                          <span className="tabular-nums font-medium">{stats.courseCount}</span>
                          <span className="hidden sm:inline">
                            {stats.courseCount === 1 ? 'course' : 'courses'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-4 text-brand" aria-hidden="true" />
                          <span className="tabular-nums font-medium">
                            {Math.round(stats.totalHours)}h
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="size-4 text-brand" aria-hidden="true" />
                          <span className="tabular-nums font-medium">{stats.totalLessons}</span>
                          <span className="hidden sm:inline">lessons</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Action Buttons (hover overlay) */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-card"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      setEditAuthor(author)
                    }}
                    aria-label={`Edit ${author.name}`}
                    data-testid="edit-author-button"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-destructive/10 hover:text-destructive"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDeleteAuthor(author)
                    }}
                    aria-label={`Delete ${author.name}`}
                    data-testid="delete-author-button"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )
          })}
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
