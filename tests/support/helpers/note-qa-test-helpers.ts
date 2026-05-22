/**
 * Shared E2E helpers for Note Q&A / QAChatPanel tests.
 */
import type { Page } from '@playwright/test'

/** Configure Gemini as the noteQA provider with a fake E2E-only API key. */
export async function configureGeminiNoteQA(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { saveAIConfiguration, saveProviderApiKey } = await import('/src/lib/aiConfiguration.ts')

    await saveProviderApiKey(
      'gemini',
      'AIzanotPRODUCTIONneverE2Eonly_knownfakekey000000000000000000'
    )
    await saveAIConfiguration({
      provider: 'openai',
      connectionStatus: 'unconfigured',
      consentSettings: {
        videoSummary: true,
        noteQA: true,
        learningPath: true,
        knowledgeGaps: true,
        noteOrganization: true,
        analytics: true,
      },
      featureModels: {
        noteQA: {
          provider: 'gemini',
          model: 'gemini-3-flash-preview',
        },
      },
    })
  })
}
