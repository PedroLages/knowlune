import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Card, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'

interface GatedFeatureCardProps {
  title: string
  description: string
}

export function GatedFeatureCard({ title, description }: GatedFeatureCardProps) {
  const navigate = useNavigate()

  return (
    <Card data-testid="gated-feature-card">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="rounded-full bg-muted p-3">
          <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="brand"
            size="sm"
            onClick={() => navigate('/')}
            aria-label={`Sign up to unlock ${title}`}
          >
            Sign up
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            aria-label={`Sign in to unlock ${title}`}
          >
            Sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
