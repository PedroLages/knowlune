import { LegalUpdateBanner } from './LegalUpdateBanner'

const EFFECTIVE_DATE = 'March 26, 2026'
const DOCUMENT_ID = 'privacy'

const sections = [
  { id: 'information-we-collect', title: '1. Information We Collect' },
  { id: 'how-we-use-information', title: '2. How We Use Your Information' },
  { id: 'data-storage', title: '3. Data Storage & Processing' },
  { id: 'third-party-services', title: '4. Third-Party Services' },
  { id: 'your-rights', title: '5. Your Rights' },
  { id: 'data-retention', title: '6. Data Retention' },
  { id: 'security', title: '7. Security' },
  { id: 'childrens-privacy', title: "8. Children's Privacy" },
  { id: 'changes', title: '9. Changes to This Policy' },
  { id: 'contact', title: '10. Contact Us' },
]

export function PrivacyPolicy() {
  return (
    <article className="space-y-8">
      <LegalUpdateBanner
        documentId={DOCUMENT_ID}
        effectiveDate={EFFECTIVE_DATE}
        documentName="Privacy Policy"
      />

      {/* Page header */}
      <header>
        <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
          Privacy Policy
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
                className="text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {section.title.replace(/^\d+\.\s/, '')}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Introduction */}
      <div className="prose-legal space-y-4 text-foreground leading-relaxed">
        <p>
          At Knowlune, we take your privacy seriously. This Privacy Policy explains how we collect,
          use, store, and protect your personal information when you use our learning platform.
        </p>
        <p>
          By using Knowlune, you agree to the collection and use of information as described in this
          policy.
        </p>
      </div>

      {/* Section 1 */}
      <section id="information-we-collect" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          1. Information We Collect
        </h2>
        <p className="text-foreground leading-relaxed">
          We collect information that you provide directly and information generated through your use
          of the platform:
        </p>
        <h3 className="font-display text-base font-medium text-foreground">
          1.1 Information You Provide
        </h3>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>Account information (name, email address, profile photo)</li>
          <li>Authentication credentials (managed securely via Supabase)</li>
          <li>Payment information (processed by Stripe; we do not store card details)</li>
          <li>User-generated content (notes, bookmarks, study preferences)</li>
        </ul>
        <h3 className="font-display text-base font-medium text-foreground">
          1.2 Automatically Collected Information
        </h3>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>Learning progress and study session data (duration, completion rates)</li>
          <li>Quiz results and performance analytics</li>
          <li>Device information and browser type</li>
          <li>Usage patterns to improve the learning experience</li>
        </ul>
      </section>

      {/* Section 2 */}
      <section id="how-we-use-information" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          2. How We Use Your Information
        </h2>
        <p className="text-foreground leading-relaxed">We use the information we collect to:</p>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>Provide and maintain the Knowlune learning platform</li>
          <li>Track your learning progress, streaks, and achievements</li>
          <li>Generate personalized study recommendations and analytics</li>
          <li>Process subscription payments and manage your account</li>
          <li>Send study reminders and course update notifications (if enabled)</li>
          <li>Improve our platform through aggregated, anonymized usage data</li>
          <li>Provide customer support and respond to inquiries</li>
        </ul>
      </section>

      {/* Section 3 */}
      <section id="data-storage" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          3. Data Storage & Processing
        </h2>
        <p className="text-foreground leading-relaxed">
          Knowlune uses a hybrid storage approach for optimal performance and privacy:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>
            <strong>Local storage:</strong> Study progress, notes, and preferences are stored
            locally in your browser using IndexedDB for offline access and fast performance.
          </li>
          <li>
            <strong>Cloud storage:</strong> Account data, subscription information, and sync data
            are stored securely on Supabase (hosted on AWS infrastructure).
          </li>
          <li>
            <strong>AI processing:</strong> When using AI-powered features (learning paths,
            knowledge gaps), queries may be processed by on-device models via WebLLM or through our
            Ollama proxy server. No AI conversation data is stored on external servers.
          </li>
        </ul>
      </section>

      {/* Section 4 */}
      <section id="third-party-services" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          4. Third-Party Services
        </h2>
        <p className="text-foreground leading-relaxed">
          We integrate with the following third-party services:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>
            <strong>Supabase:</strong> Authentication and cloud data storage
          </li>
          <li>
            <strong>Stripe:</strong> Payment processing for premium subscriptions
          </li>
          <li>
            <strong>Google OAuth:</strong> Optional sign-in via Google account
          </li>
        </ul>
        <p className="text-foreground leading-relaxed">
          Each of these services has their own privacy policy. We encourage you to review them. We do
          not sell your personal information to any third party.
        </p>
      </section>

      {/* Section 5 */}
      <section id="your-rights" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">5. Your Rights</h2>
        <p className="text-foreground leading-relaxed">You have the right to:</p>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>
            <strong>Access:</strong> Request a copy of the personal data we hold about you
          </li>
          <li>
            <strong>Correction:</strong> Update or correct inaccurate personal information
          </li>
          <li>
            <strong>Deletion:</strong> Request deletion of your account and associated data
          </li>
          <li>
            <strong>Portability:</strong> Export your learning data in a standard format
          </li>
          <li>
            <strong>Withdraw consent:</strong> Opt out of optional data collection at any time
          </li>
        </ul>
        <p className="text-foreground leading-relaxed">
          To exercise any of these rights, please contact us using the details in Section 10.
        </p>
      </section>

      {/* Section 6 */}
      <section id="data-retention" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">6. Data Retention</h2>
        <p className="text-foreground leading-relaxed">
          We retain your personal information for as long as your account is active or as needed to
          provide you with our services. Locally stored data (IndexedDB) remains on your device until
          you clear it. Cloud-stored data is deleted within 30 days of account deletion request.
        </p>
      </section>

      {/* Section 7 */}
      <section id="security" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">7. Security</h2>
        <p className="text-foreground leading-relaxed">
          We implement industry-standard security measures to protect your information, including
          encryption in transit (TLS/HTTPS), secure authentication via Supabase, and PCI-compliant
          payment processing through Stripe. However, no method of transmission over the internet is
          100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      {/* Section 8 */}
      <section id="childrens-privacy" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          8. Children&apos;s Privacy
        </h2>
        <p className="text-foreground leading-relaxed">
          Knowlune is not directed to children under the age of 13. We do not knowingly collect
          personal information from children under 13. If you believe we have collected information
          from a child under 13, please contact us and we will promptly delete it.
        </p>
      </section>

      {/* Section 9 */}
      <section id="changes" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          9. Changes to This Policy
        </h2>
        <p className="text-foreground leading-relaxed">
          We may update this Privacy Policy from time to time. When we make material changes, we will
          notify you by displaying a banner on the privacy policy page and updating the effective
          date. We encourage you to review this policy periodically.
        </p>
      </section>

      {/* Section 10 */}
      <section id="contact" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">10. Contact Us</h2>
        <p className="text-foreground leading-relaxed">
          If you have any questions about this Privacy Policy or our data practices, please contact
          us at:
        </p>
        <address className="not-italic rounded-xl border border-border bg-card p-4 text-foreground leading-relaxed">
          <strong>Knowlune Privacy Team</strong>
          <br />
          Email: privacy@knowlune.com
        </address>
      </section>
    </article>
  )
}
