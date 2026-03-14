/**
 * Window type declarations for note organization test mocking
 */

import type { NoteOrganizationProposal } from './noteOrganizer'

declare global {
  interface Window {
    __mockNoteOrganizationResponse?: {
      proposals: NoteOrganizationProposal[]
    }
  }
}

export {}
