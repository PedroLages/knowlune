import { ArrowRight, BookOpen, FileText, FolderOpen, RefreshCw, Video } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

export function OverviewNewLearner({ onImport }: { onImport: () => void }) {
  return (
    <section
      className="relative isolate overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10"
      aria-labelledby="new-learner-title"
      data-testid="overview-new-learner"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-brand-soft/60"
        aria-hidden="true"
      />
      <div className="max-w-2xl">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
          <BookOpen className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Your first step
        </p>
        <h2
          id="new-learner-title"
          className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Bring one course. We will organize the rest.
        </h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          Import a folder of lessons and Knowlune will turn your videos and PDFs into a focused,
          trackable learning path.
        </p>
        <Button
          type="button"
          size="lg"
          className="mt-6 min-h-11"
          onClick={onImport}
          data-testid="overview-import-course"
        >
          <FolderOpen className="size-4" aria-hidden="true" />
          Import your first course
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: Video, label: 'Video lessons', detail: 'Resume from your last position' },
          { icon: FileText, label: 'PDF material', detail: 'Keep reading progress together' },
          { icon: RefreshCw, label: 'Smart review', detail: 'See what deserves attention next' },
        ].map(item => (
          <div key={item.label} className="rounded-2xl bg-muted/60 p-4">
            <item.icon className="size-4 text-brand" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
