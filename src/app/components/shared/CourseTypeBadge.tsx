import { Badge } from '@/app/components/ui/badge'

interface CourseTypeBadgeProps {
  courseType: 'imported' | 'catalog'
}

export function CourseTypeBadge({ courseType }: CourseTypeBadgeProps) {
  return (
    <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wider">
      {courseType === 'imported' ? 'Imported' : 'Catalog'}
    </Badge>
  )
}
