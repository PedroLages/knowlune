import { Link, Outlet } from 'react-router'
import { KnowluneLogo } from '@/app/components/figma/KnowluneLogo'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

/**
 * Minimal layout for public legal pages (/privacy, /terms).
 * No sidebar, no auth required — just logo header, content area, and footer.
 */
export function LegalLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card" role="banner">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2" aria-label="Knowlune home">
            <KnowluneLogo />
          </Link>
          <Button variant="ghost" size="sm" asChild className="gap-1.5 min-h-[44px]">
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to app
            </Link>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-4xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} Knowlune. All rights reserved.</p>
          <nav aria-label="Legal links" className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
