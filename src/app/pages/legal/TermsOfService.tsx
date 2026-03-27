import { LegalUpdateBanner } from './LegalUpdateBanner'

const EFFECTIVE_DATE = 'March 26, 2026'
const DOCUMENT_ID = 'terms'

const sections = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'description', title: '2. Description of Service' },
  { id: 'accounts', title: '3. User Accounts' },
  { id: 'subscriptions', title: '4. Subscriptions & Payments' },
  { id: 'acceptable-use', title: '5. Acceptable Use' },
  { id: 'intellectual-property', title: '6. Intellectual Property' },
  { id: 'user-content', title: '7. User-Generated Content' },
  { id: 'disclaimers', title: '8. Disclaimers' },
  { id: 'limitation', title: '9. Limitation of Liability' },
  { id: 'termination', title: '10. Termination' },
  { id: 'changes', title: '11. Changes to Terms' },
  { id: 'governing-law', title: '12. Governing Law' },
  { id: 'contact', title: '13. Contact Us' },
]

export function TermsOfService() {
  return (
    <article className="space-y-8">
      <LegalUpdateBanner
        documentId={DOCUMENT_ID}
        effectiveDate={EFFECTIVE_DATE}
        documentName="Terms of Service"
      />

      {/* Page header */}
      <header>
        <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: <time dateTime="2026-03-26">{EFFECTIVE_DATE}</time>
        </p>
      </header>

      {/* Table of contents */}
      <nav
        aria-label="Table of contents"
        className="rounded-[24px] border border-border bg-card p-6"
      >
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
          Table of Contents
        </h2>
        <ol className="list-decimal list-inside space-y-1.5 text-sm">
          {sections.map(section => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {section.title.replace(/^\d+\.\s/, '')}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Introduction */}
      <div className="space-y-4 text-foreground leading-relaxed">
        <p>
          Welcome to Knowlune. These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of the Knowlune learning platform. Please read them carefully before using our
          service.
        </p>
      </div>

      {/* Section 1 */}
      <section id="acceptance" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          1. Acceptance of Terms
        </h2>
        <p className="text-foreground leading-relaxed">
          By creating an account or using Knowlune, you agree to be bound by these Terms of Service
          and our{' '}
          <a
            href="/privacy"
            className="text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Privacy Policy
          </a>
          . If you do not agree to these terms, you may not use the service.
        </p>
      </section>

      {/* Section 2 */}
      <section id="description" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          2. Description of Service
        </h2>
        <p className="text-foreground leading-relaxed">
          Knowlune is a personal learning platform that provides course management, progress
          tracking, study streaks, achievement analytics, and AI-powered learning tools. The
          platform offers both free and premium subscription tiers with varying levels of
          functionality.
        </p>
      </section>

      {/* Section 3 */}
      <section id="accounts" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">3. User Accounts</h2>
        <p className="text-foreground leading-relaxed">
          To access certain features, you must create an account. You are responsible for:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>Providing accurate and complete registration information</li>
          <li>Maintaining the security of your account credentials</li>
          <li>All activities that occur under your account</li>
          <li>Notifying us immediately of any unauthorized access</li>
        </ul>
        <p className="text-foreground leading-relaxed">
          You must be at least 13 years of age to create an account. By creating an account, you
          represent that you meet this age requirement.
        </p>
      </section>

      {/* Section 4 */}
      <section id="subscriptions" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          4. Subscriptions & Payments
        </h2>
        <p className="text-foreground leading-relaxed">
          Knowlune offers premium subscriptions processed through Stripe. By subscribing:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>You authorize recurring charges at the subscription rate displayed at checkout</li>
          <li>Subscriptions renew automatically unless cancelled before the renewal date</li>
          <li>
            You may cancel your subscription at any time through the billing portal; access
            continues until the end of the current billing period
          </li>
          <li>Refunds are handled on a case-by-case basis; contact us for refund requests</li>
        </ul>
        <p className="text-foreground leading-relaxed">
          Prices are subject to change with 30 days&apos; notice. Changes will not affect your
          current billing period.
        </p>
      </section>

      {/* Section 5 */}
      <section id="acceptable-use" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">5. Acceptable Use</h2>
        <p className="text-foreground leading-relaxed">You agree not to:</p>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>Use the platform for any unlawful purpose</li>
          <li>Attempt to reverse-engineer, decompile, or disassemble the platform</li>
          <li>Share, redistribute, or commercially exploit course content without authorization</li>
          <li>Interfere with or disrupt the platform or its infrastructure</li>
          <li>Create multiple accounts for the purpose of abusing free-tier limitations</li>
          <li>Scrape, crawl, or use automated tools to extract content from the platform</li>
        </ul>
      </section>

      {/* Section 6 */}
      <section id="intellectual-property" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          6. Intellectual Property
        </h2>
        <p className="text-foreground leading-relaxed">
          The Knowlune platform, including its design, code, branding, and original content, is
          owned by Knowlune and protected by intellectual property laws. Course content provided by
          third-party authors remains the property of their respective creators and is licensed to
          Knowlune for distribution through the platform.
        </p>
      </section>

      {/* Section 7 */}
      <section id="user-content" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          7. User-Generated Content
        </h2>
        <p className="text-foreground leading-relaxed">
          You retain ownership of content you create within Knowlune (notes, bookmarks, study
          preferences). By using the platform, you grant Knowlune a limited license to store and
          process this content solely for the purpose of providing the service to you. We will not
          share, sell, or use your content for any other purpose.
        </p>
      </section>

      {/* Section 8 */}
      <section id="disclaimers" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">8. Disclaimers</h2>
        <p className="text-foreground leading-relaxed">
          Knowlune is provided &quot;as is&quot; and &quot;as available&quot; without warranties of
          any kind, either express or implied. We do not warrant that the service will be
          uninterrupted, error-free, or that any content will be accurate or complete. AI-generated
          recommendations are provided for informational purposes only and should not be relied upon
          as professional educational advice.
        </p>
      </section>

      {/* Section 9 */}
      <section id="limitation" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          9. Limitation of Liability
        </h2>
        <p className="text-foreground leading-relaxed">
          To the maximum extent permitted by law, Knowlune shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, including but not limited to loss
          of data, loss of profits, or interruption of service, arising from your use of or
          inability to use the platform.
        </p>
      </section>

      {/* Section 10 */}
      <section id="termination" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">10. Termination</h2>
        <p className="text-foreground leading-relaxed">
          We may suspend or terminate your account if you violate these Terms. You may delete your
          account at any time through the Settings page. Upon termination, your right to use the
          service ceases immediately, and locally stored data will remain on your device until you
          clear it. Cloud-stored data will be deleted in accordance with our Privacy Policy.
        </p>
      </section>

      {/* Section 11 */}
      <section id="changes" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">11. Changes to Terms</h2>
        <p className="text-foreground leading-relaxed">
          We may update these Terms from time to time. When we make material changes, we will notify
          you by displaying a banner on this page and updating the effective date. Continued use of
          the platform after changes constitutes acceptance of the updated Terms.
        </p>
      </section>

      {/* Section 12 */}
      <section id="governing-law" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">12. Governing Law</h2>
        <p className="text-foreground leading-relaxed">
          These Terms shall be governed by and construed in accordance with the laws of the
          jurisdiction in which Knowlune operates, without regard to conflict of law principles.
        </p>
      </section>

      {/* Section 13 */}
      <section id="contact" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">13. Contact Us</h2>
        <p className="text-foreground leading-relaxed">
          If you have any questions about these Terms of Service, please contact us at:
        </p>
        <address className="not-italic rounded-xl border border-border bg-card p-4 text-foreground leading-relaxed">
          <strong>Knowlune Legal Team</strong>
          <br />
          Email: legal@knowlune.com
        </address>
      </section>
    </article>
  )
}
