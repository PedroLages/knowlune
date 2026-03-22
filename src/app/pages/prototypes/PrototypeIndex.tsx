import { Link } from 'react-router'

const prototypes = [
  {
    title: 'Swiss Overview',
    path: '/prototypes/swiss-overview',
    description:
      'Full Swiss/International Style. Helvetica Neue, sharp rectangles, red accent, flat design with rules.',
    style: 'swiss' as const,
  },
  {
    title: 'Swiss Courses',
    path: '/prototypes/swiss-courses',
    description:
      'Swiss course catalog. Monochrome badges, underline tabs, mathematical grid, zero decoration.',
    style: 'swiss' as const,
  },
  {
    title: 'Hybrid Overview',
    path: '/prototypes/hybrid-overview',
    description:
      'Selective Swiss borrowing. Keeps warm palette and fonts, adds grid discipline and whitespace.',
    style: 'hybrid' as const,
  },
  {
    title: 'Hybrid Courses',
    path: '/prototypes/hybrid-courses',
    description:
      'Hybrid course catalog. Reduced radius, subtle shadows, muted badges, cleaner layout.',
    style: 'hybrid' as const,
  },
]

const originals = [
  {
    title: 'Original Overview',
    path: '/',
    description: 'Current warm design with rounded cards and playful interactions.',
  },
  {
    title: 'Original Courses',
    path: '/courses',
    description: 'Current course catalog with colorful badges and hover animations.',
  },
]

export function PrototypeIndex() {
  return (
    <div
      className="min-h-screen bg-neutral-50"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto px-8 py-16">
        <Link to="/" className="text-sm text-neutral-500 hover:text-black transition-colors">
          &larr; Back to App
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4 tracking-tight">Design Prototypes</h1>
        <p className="text-lg text-neutral-500 mb-16 max-w-2xl">
          Compare the current Knowlune design against Swiss/International Style alternatives. Each
          prototype reimagines the same pages with different design principles.
        </p>

        {/* Prototypes */}
        <section className="mb-16">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-6">
            Prototypes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prototypes.map(p => (
              <Link
                key={p.path}
                to={p.path}
                className="group block border border-neutral-200 hover:border-neutral-900 transition-colors p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold group-hover:text-neutral-900 transition-colors">
                    {p.title}
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 ${
                      p.style === 'swiss' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                    }`}
                  >
                    {p.style}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 leading-relaxed">{p.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Originals */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-6">
            Originals (for comparison)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {originals.map(o => (
              <Link
                key={o.path}
                to={o.path}
                className="group block border border-neutral-200 hover:border-neutral-900 transition-colors p-6"
              >
                <h3 className="text-lg font-bold mb-2 group-hover:text-neutral-900 transition-colors">
                  {o.title}
                </h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{o.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-neutral-200 text-xs text-neutral-400">
          These prototypes are for design comparison only. They use real data but simplified
          layouts.
        </footer>
      </div>
    </div>
  )
}
