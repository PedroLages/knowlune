import {
  GraduationCap,
  BookOpen,
  FileText,
  StickyNote,
  Highlighter,
  User,
} from 'lucide-react'
import type { EntityType } from '@/lib/unifiedSearch'

export const SECTION_ORDER: Array<{ type: EntityType; heading: string; icon: typeof GraduationCap }> = [
  { type: 'course', heading: 'Courses', icon: GraduationCap },
  { type: 'book', heading: 'Books', icon: BookOpen },
  { type: 'lesson', heading: 'Lessons', icon: FileText },
  { type: 'note', heading: 'Notes', icon: StickyNote },
  { type: 'highlight', heading: 'Book Highlights', icon: Highlighter },
  { type: 'author', heading: 'Authors', icon: User },
]

export const TYPE_BADGE_LABEL: Record<EntityType, string> = {
  course: 'Course',
  book: 'Book',
  lesson: 'Lesson',
  note: 'Note',
  highlight: 'Highlight',
  author: 'Author',
}

export const TYPE_BADGE_CLASS: Record<EntityType, string> = {
  course: 'bg-brand-soft text-brand-soft-foreground',
  book: 'bg-success-soft text-success',
  lesson: 'bg-warning/10 text-warning',
  note: 'bg-muted text-muted-foreground',
  highlight: 'bg-success/10 text-success',
  author: 'bg-secondary text-secondary-foreground',
}
