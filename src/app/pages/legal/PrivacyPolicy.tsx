import {
  CURRENT_NOTICE_VERSION,
  NOTICE_DOCUMENT_ID,
  formatNoticeEffectiveDate,
} from '@/lib/compliance/noticeVersion'
import { LegalUpdateBanner } from './LegalUpdateBanner'

const sections = [
  { id: 'information-we-collect', title: '1. Information We Collect' },
  { id: 'how-we-use-information', title: '2. How We Use Your Information' },
  { id: 'lawful-basis', title: '3. Lawful Basis for Processing' },
  { id: 'data-storage', title: '4. Data Storage & Processing' },
  { id: 'sub-processors', title: '5. Sub-Processors' },
  { id: 'your-rights', title: '6. Your Rights' },
  { id: 'data-retention', title: '7. Data Retention' },
  { id: 'security', title: '8. Security' },
  { id: 'ai-processing', title: '9. AI Processing Disclosure' },
  { id: 'childrens-privacy', title: "10. Children's Privacy" },
  { id: 'changes', title: '11. Changes to This Policy' },
  { id: 'supervisory-authority', title: '12. Supervisory Authority' },
  { id: 'contact', title: '13. Contact Us' },
]

export function PrivacyPolicy() {
  const effectiveDate = formatNoticeEffectiveDate(CURRENT_NOTICE_VERSION)

  return (
    <article className="space-y-8">
      <LegalUpdateBanner
        documentId={NOTICE_DOCUMENT_ID}
        effectiveDate={effectiveDate}
        documentName="Privacy Policy"
      />

      {/* Page header */}
      <header>
        <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {effectiveDate} &mdash; version {CURRENT_NOTICE_VERSION}
        </p>
      </header>

      {/* Table of contents */}
      <nav aria-label="Table of contents" className="rounded-2xl border border-border bg-card p-6">
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
      <div className="prose-legal space-y-4 text-foreground leading-relaxed">
        <p>
          At Knowlune, we take your privacy seriously. This Privacy Policy explains how we collect,
          use, store, and protect your personal information when you use our learning platform.
        </p>
        <p>
          By using Knowlune, you agree to the collection and use of information as described in this
          policy. The canonical source of this notice is maintained at{' '}
          <code className="text-sm bg-muted px-1 py-0.5 rounded">
            docs/compliance/privacy-notice.md
          </code>{' '}
          in our repository.
        </p>
      </div>

      {/* Section 1 */}
      <section id="information-we-collect" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          1. Information We Collect
        </h2>
        <p className="text-foreground leading-relaxed">
          We collect information that you provide directly and information generated through your
          use of the platform:
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

      {/* Section 3 — Lawful basis (Art 13 required) */}
      <section id="lawful-basis" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          3. Lawful Basis for Processing
        </h2>
        <p className="text-foreground leading-relaxed">
          We process your personal data only where we have a lawful basis under GDPR Art 6:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-foreground border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
                <th className="text-left py-2 pr-4 font-semibold">Lawful basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 leading-relaxed">Providing and maintaining the platform</td>
                <td className="py-2 pr-4 leading-relaxed">Art 6(1)(b) — performance of a contract</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 leading-relaxed">Progress tracking and achievements</td>
                <td className="py-2 pr-4 leading-relaxed">Art 6(1)(b) — performance of a contract</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 leading-relaxed">Processing subscription payments</td>
                <td className="py-2 pr-4 leading-relaxed">Art 6(1)(b) — performance of a contract</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 leading-relaxed">Study reminders and notifications (optional)</td>
                <td className="py-2 pr-4 leading-relaxed">Art 6(1)(a) — consent (withdrawable in Settings)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 leading-relaxed">Aggregated platform analytics</td>
                <td className="py-2 pr-4 leading-relaxed">Art 6(1)(f) — legitimate interests (platform improvement)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 leading-relaxed">AI-assisted features</td>
                <td className="py-2 pr-4 leading-relaxed">Art 6(1)(b) — performance of a contract; on-device or self-hosted only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4 */}
      <section id="data-storage" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          4. Data Storage & Processing
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
            are stored securely on Supabase (hosted on AWS eu-west-1, Ireland).
          </li>
          <li>
            <strong>AI processing:</strong> When using AI-powered features (learning paths,
            knowledge gaps), queries may be processed by on-device models via WebLLM or through our
            self-hosted Ollama proxy server. No AI conversation data is stored on external servers.
          </li>
        </ul>
      </section>

      {/* Section 5 — Sub-processors (Art 13 required) */}
      <section id="sub-processors" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          5. Sub-Processors
        </h2>
        <p className="text-foreground leading-relaxed">
          We integrate with the following third-party sub-processors, each bound by a data
          processing agreement:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-foreground border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold">Sub-processor</th>
                <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
                <th className="text-left py-2 font-semibold">Data location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-medium">Supabase (AWS)</td>
                <td className="py-2 pr-4">Authentication and cloud data storage</td>
                <td className="py-2">AWS eu-west-1 (Ireland)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">Stripe</td>
                <td className="py-2 pr-4">Payment processing for premium subscriptions</td>
                <td className="py-2">United States (Stripe Inc.)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">Google OAuth</td>
                <td className="py-2 pr-4">Optional sign-in via Google account</td>
                <td className="py-2">Google servers (EU/US)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-foreground leading-relaxed">
          We do not sell your personal information to any third party.
        </p>
      </section>

      {/* Section 6 */}
      <section id="your-rights" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">6. Your Rights</h2>
        <p className="text-foreground leading-relaxed">
          Under the GDPR (and applicable national law), you have the right to:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>
            <strong>Access (Art 15):</strong> Request a copy of the personal data we hold about you
          </li>
          <li>
            <strong>Rectification (Art 16):</strong> Update or correct inaccurate personal information
          </li>
          <li>
            <strong>Erasure / right to be forgotten (Art 17):</strong> Request deletion of your account and associated data
          </li>
          <li>
            <strong>Restriction (Art 18):</strong> Request that we limit processing of your data
          </li>
          <li>
            <strong>Data portability (Art 20):</strong> Export your learning data in a standard format
          </li>
          <li>
            <strong>Object (Art 21):</strong> Object to processing based on legitimate interests
          </li>
          <li>
            <strong>Withdraw consent (Art 7(3)):</strong> Opt out of optional data collection at any time via Settings
          </li>
        </ul>
        <p className="text-foreground leading-relaxed">
          To exercise any of these rights, contact us at{' '}
          <a
            href="mailto:privacy@knowlune.com"
            className="text-brand-soft-foreground hover:underline"
          >
            privacy@knowlune.com
          </a>
          . We will respond within 30 days.
        </p>
      </section>

      {/* Section 7 */}
      <section id="data-retention" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">7. Data Retention</h2>
        <p className="text-foreground leading-relaxed">
          We retain your personal information for as long as your account is active or as needed to
          provide you with our services. Locally stored data (IndexedDB) remains on your device
          until you clear it. Cloud-stored data is deleted within 30 days of account deletion
          request. Payment references are retained as required by applicable financial regulations
          (typically 7 years).
        </p>
      </section>

      {/* Section 8 */}
      <section id="security" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">8. Security</h2>
        <p className="text-foreground leading-relaxed">
          We implement industry-standard security measures to protect your information, including
          encryption in transit (TLS/HTTPS), secure authentication via Supabase, and PCI-compliant
          payment processing through Stripe. However, no method of transmission over the internet is
          100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      {/* Section 9 — AI processing disclosure (Art 13 required) */}
      <section id="ai-processing" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          9. AI Processing Disclosure
        </h2>
        <p className="text-foreground leading-relaxed">
          Knowlune offers optional AI-assisted features (learning path suggestions, knowledge gap
          analysis). All AI processing is either on-device or self-hosted:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground leading-relaxed pl-2">
          <li>
            <strong>On-device AI (WebLLM):</strong> Runs entirely in your browser. No data leaves
            your device.
          </li>
          <li>
            <strong>Self-hosted Ollama proxy:</strong> Queries may be routed to a self-hosted
            Ollama server operated by Knowlune. No AI conversation data is stored on that server
            beyond the active session.
          </li>
          <li>
            <strong>No external AI providers:</strong> We do not send your learning data or AI
            queries to OpenAI, Anthropic, Google, or any other third-party AI provider.
          </li>
        </ul>
        <p className="text-foreground leading-relaxed">
          AI features are opt-in and can be disabled in Settings &rarr; AI Features.
        </p>
      </section>

      {/* Section 10 */}
      <section id="childrens-privacy" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          10. Children&apos;s Privacy
        </h2>
        <p className="text-foreground leading-relaxed">
          Knowlune is not directed to children under the age of 13 (or 16 where applicable under
          national law). We do not knowingly collect personal information from children. If you
          believe we have collected information from a child, please contact us and we will promptly
          delete it.
        </p>
      </section>

      {/* Section 11 */}
      <section id="changes" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          11. Changes to This Policy
        </h2>
        <p className="text-foreground leading-relaxed">
          We may update this Privacy Policy from time to time. When we make material changes, we
          will notify you by displaying a banner on the privacy policy page and updating the version
          number and effective date at the top of this page. We encourage you to review this policy
          periodically.
        </p>
      </section>

      {/* Section 12 — Supervisory authority (Art 13 required) */}
      <section id="supervisory-authority" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          12. Supervisory Authority
        </h2>
        <p className="text-foreground leading-relaxed">
          If you believe your data protection rights have been violated, you have the right to lodge
          a complaint with your local data protection supervisory authority. In Portugal
          (controller&apos;s country), the supervisory authority is the{' '}
          <strong>Comiss&atilde;o Nacional de Prote&ccedil;&atilde;o de Dados (CNPD)</strong>. You
          may also lodge a complaint with the supervisory authority of your EU member state of
          habitual residence.
        </p>
      </section>

      {/* Section 13 */}
      <section id="contact" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">13. Contact Us</h2>
        <p className="text-foreground leading-relaxed">
          If you have any questions about this Privacy Policy or our data practices, please contact
          us at:
        </p>
        <address className="not-italic rounded-xl border border-border bg-card p-4 text-foreground leading-relaxed">
          <strong>Knowlune Privacy Team</strong>
          <br />
          Email:{' '}
          <a
            href="mailto:privacy@knowlune.com"
            className="text-brand-soft-foreground hover:underline"
          >
            privacy@knowlune.com
          </a>
        </address>
      </section>
    </article>
  )
}
