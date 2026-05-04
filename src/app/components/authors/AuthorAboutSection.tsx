import { BookOpen, Award } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
import type { AuthorView } from '@/lib/authors'

interface AuthorAboutSectionProps {
  author: AuthorView
  headingLevel?: 'h2' | 'h3'
  educationIcon?: 'book' | 'award'
}

const iconMap = {
  book: BookOpen,
  award: Award,
} as const

/**
 * Shared about section for author profile pages.
 * Renders an author's bio (split by paragraphs) and optional education.
 */
export function AuthorAboutSection({
  author,
  headingLevel = 'h2',
  educationIcon = 'book',
}: AuthorAboutSectionProps) {
  const Heading = headingLevel
  const Icon = iconMap[educationIcon]

  if (!author.bio) return null

  return (
    <Card className="rounded-2xl border-0 shadow-sm mb-6">
      <CardContent className="p-6 sm:p-8">
        <Heading className="text-lg font-semibold mb-4">About</Heading>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          {author.bio.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
        {author.education && (
          <>
            <Separator className="my-5" />
            <div className="flex items-center gap-2 text-sm">
              <Icon className="size-4 text-brand" aria-hidden="true" />
              <span className="font-medium">Education:</span>
              <span className="text-muted-foreground">{author.education}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
