import { Link } from 'react-router'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { KnowluneLogo } from '@/app/components/figma/KnowluneLogo'

const COMPARISON_ROWS = [
  { feature: 'Import content', guest: '1 item', account: 'Unlimited' },
  { feature: 'Sync across devices', guest: false, account: true },
  { feature: 'Learning streaks', guest: false, account: true },
  { feature: 'AI summaries', guest: false, account: true },
  { feature: 'Progress saved', guest: 'Session only', account: 'Forever' },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return (
      <span className="flex justify-center">
        <CheckCircle2 className="size-5 text-success" aria-label="Yes" />
      </span>
    )
  if (value === false)
    return (
      <span className="flex justify-center">
        <X className="size-5 text-muted-foreground/50" aria-label="No" />
      </span>
    )
  return <span className="text-sm text-center block">{value}</span>
}

export function GuestEntry() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg flex flex-col gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1">
          <Link to="/" aria-label="Knowlune home">
            <KnowluneLogo />
          </Link>
          <p className="text-xs tracking-wide text-muted-foreground">Illuminate Your Path</p>
        </div>

        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Try Knowlune — no account needed
          </h1>
          <p className="text-muted-foreground text-sm">
            See what you can do before you commit.
          </p>
        </div>

        {/* Comparison table */}
        <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40">
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Feature
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Guest
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-brand-soft-foreground uppercase tracking-wider bg-brand-soft/40">
                  Account
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(({ feature, guest, account }, i) => (
                <tr key={feature} className={`border-b last:border-b-0 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                  <td className="px-4 py-3.5 text-sm font-medium text-foreground">{feature}</td>
                  <td className="px-4 py-3.5 text-center text-muted-foreground">
                    <Cell value={guest} />
                  </td>
                  <td className="px-4 py-3.5 text-center bg-brand-soft/20">
                    <Cell value={account} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reassurance badge */}
        <div className="rounded-xl bg-brand-soft border border-brand-soft px-4 py-3 text-sm text-brand-soft-foreground text-center">
          You can switch to a full account anytime — your progress comes with you.
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Button variant="brand" asChild className="w-full min-h-[44px]">
            <Link to="/">Sign up to unlock everything</Link>
          </Button>
          <Button variant="outline" asChild className="w-full min-h-[44px]">
            <Link to="/guest">Continue as guest</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
