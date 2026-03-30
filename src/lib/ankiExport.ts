/**
 * Anki .apkg export for PKM integration.
 *
 * Generates Anki-compatible .apkg files (SQLite DB + ZIP) from Knowlune flashcards.
 * Uses sql.js (ASM.js build — no WASM binary needed) + JSZip for .apkg generation.
 * Dynamic import() keeps ~500KB sql.js off the main bundle.
 *
 * Deck: Single "Knowlune Export" deck with course-name tags per card.
 * Tags: Reuses `deriveFlashcardTags()` from flashcardExport.ts.
 */
import { db } from '@/db/schema'
import type { Flashcard, Note } from '@/data/types'
import type { ExportProgressCallback } from './exportService'
import { deriveFlashcardTags } from './flashcardExport'
import { stripHtml } from './textUtils'
import { yieldToUI } from './uiUtils'

const DECK_NAME = 'Knowlune Export'

/**
 * Generate the Anki collection SQL schema template.
 *
 * This creates the SQLite schema that Anki expects inside an .apkg file.
 * Adapted from anki-apkg-export's template.js.
 */
function createAnkiTemplate(): string {
  const conf = {
    nextPos: 1,
    estTimes: true,
    activeDecks: [1],
    sortType: 'noteFld',
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: 1,
    newBury: true,
    newSpread: 0,
    dueCounts: true,
    curModel: '1435645724216',
    collapseTime: 1200,
  }

  const models = {
    1388596687391: {
      vers: [],
      name: 'Basic-f15d2',
      tags: ['Tag'],
      did: 1435588830424,
      usn: -1,
      req: [[0, 'all', [0]]],
      flds: [
        { name: 'Front', media: [], sticky: false, rtl: false, ord: 0, font: 'Arial', size: 20 },
        { name: 'Back', media: [], sticky: false, rtl: false, ord: 1, font: 'Arial', size: 20 },
      ],
      sortf: 0,
      latexPre:
        '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      tmpls: [
        {
          name: 'Card 1',
          qfmt: '{{Front}}',
          did: null,
          bafmt: '',
          afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
          ord: 0,
          bqfmt: '',
        },
      ],
      latexPost: '\\end{document}',
      type: 0,
      id: 1388596687391,
      css: '.card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\nbackground-color: white;\n}\n',
      mod: 1435645658,
    },
  }

  const decks = {
    1: {
      desc: '',
      name: 'Default',
      extendRev: 50,
      usn: 0,
      collapsed: false,
      newToday: [0, 0],
      timeToday: [0, 0],
      dyn: 0,
      extendNew: 10,
      conf: 1,
      revToday: [0, 0],
      lrnToday: [0, 0],
      id: 1,
      mod: 1435645724,
    },
    1435588830424: {
      desc: '',
      name: 'Template',
      extendRev: 50,
      usn: -1,
      collapsed: false,
      newToday: [545, 0],
      timeToday: [545, 0],
      dyn: 0,
      extendNew: 10,
      conf: 1,
      revToday: [545, 0],
      lrnToday: [545, 0],
      id: 1435588830424,
      mod: 1435588830,
    },
  }

  const dconf = {
    1: {
      name: 'Default',
      replayq: true,
      lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 0, mult: 0 },
      rev: { perDay: 100, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, ease4: 1.3, bury: true, minSpace: 1 },
      timer: 0,
      maxTaken: 60,
      usn: 0,
      new: { perDay: 20, delays: [1, 10], separate: true, ints: [1, 4, 7], initialFactor: 2500, bury: true, order: 1 },
      mod: 0,
      id: 1,
      autoplay: true,
    },
  }

  return `
    PRAGMA foreign_keys=OFF;
    BEGIN TRANSACTION;
    CREATE TABLE col (
        id              integer primary key,
        crt             integer not null,
        mod             integer not null,
        scm             integer not null,
        ver             integer not null,
        dty             integer not null,
        usn             integer not null,
        ls              integer not null,
        conf            text not null,
        models          text not null,
        decks           text not null,
        dconf           text not null,
        tags            text not null
    );
    INSERT INTO "col" VALUES(
      1,
      1388548800,
      1435645724219,
      1435645724215,
      11,
      0,
      0,
      0,
      '${JSON.stringify(conf)}',
      '${JSON.stringify(models)}',
      '${JSON.stringify(decks)}',
      '${JSON.stringify(dconf)}',
      '{}'
    );
    CREATE TABLE notes (
        id              integer primary key,
        guid            text not null,
        mid             integer not null,
        mod             integer not null,
        usn             integer not null,
        tags            text not null,
        flds            text not null,
        sfld            integer not null,
        csum            integer not null,
        flags           integer not null,
        data            text not null
    );
    CREATE TABLE cards (
        id              integer primary key,
        nid             integer not null,
        did             integer not null,
        ord             integer not null,
        mod             integer not null,
        usn             integer not null,
        type            integer not null,
        queue           integer not null,
        due             integer not null,
        ivl             integer not null,
        factor          integer not null,
        reps            integer not null,
        lapses          integer not null,
        left            integer not null,
        odue            integer not null,
        odid            integer not null,
        flags           integer not null,
        data            text not null
    );
    CREATE TABLE revlog (
        id              integer primary key,
        cid             integer not null,
        usn             integer not null,
        ease            integer not null,
        ivl             integer not null,
        lastIvl         integer not null,
        factor          integer not null,
        time            integer not null,
        type            integer not null
    );
    CREATE TABLE graves (
        usn             integer not null,
        oid             integer not null,
        type            integer not null
    );
    ANALYZE sqlite_master;
    INSERT INTO "sqlite_stat1" VALUES('col',NULL,'1');
    CREATE INDEX ix_notes_usn on notes (usn);
    CREATE INDEX ix_cards_usn on cards (usn);
    CREATE INDEX ix_revlog_usn on revlog (usn);
    CREATE INDEX ix_cards_nid on cards (nid);
    CREATE INDEX ix_cards_sched on cards (did, queue, due);
    CREATE INDEX ix_revlog_cid on revlog (cid);
    CREATE INDEX ix_notes_csum on notes (csum);
    COMMIT;
  `
}

/**
 * Simple SHA-1 checksum (first 8 hex chars as integer).
 * Uses the SubtleCrypto API available in all modern browsers.
 */
async function sha1Checksum(input: string): Promise<number> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = new Uint8Array(hashBuffer)
  // Take first 4 bytes as hex string, parse as integer
  const hex = Array.from(hashArray.slice(0, 4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return parseInt(hex, 16)
}

/**
 * Generate a SHA-1 GUID for an Anki note (full hex string).
 */
async function sha1Guid(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert tags array to Anki's space-delimited tag format.
 * Anki expects tags wrapped in spaces: " tag1 tag2 "
 * Spaces within tags are replaced with underscores.
 */
function tagsToAnkiString(tags: string[]): string {
  if (tags.length === 0) return ''
  return ' ' + tags.map(tag => tag.replace(/ /g, '_')).join(' ') + ' '
}

const SEPARATOR = '\x1F' // Anki field separator

/**
 * Exports all flashcards as an Anki-compatible .apkg file.
 *
 * Returns a Blob containing the .apkg file, or null if no flashcards exist.
 * Uses dynamic import() for sql.js to keep the main bundle lean (~500KB excluded).
 *
 * @param onProgress - Optional callback for progress updates
 * @returns Blob with .apkg content, or null if no flashcards
 */
export async function exportFlashcardsAsAnki(
  onProgress?: ExportProgressCallback
): Promise<Blob | null> {
  onProgress?.(0, 'Loading flashcards...')
  const flashcards = await db.flashcards.toArray()

  // AC4: Return null if no flashcards (caller handles empty state)
  if (flashcards.length === 0) {
    return null
  }

  await yieldToUI()

  // Load courses for name lookup
  onProgress?.(5, 'Loading courses...')
  const courses = await db.importedCourses.toArray()
  const courseMap = new Map(courses.map(c => [c.id, c.name]))
  await yieldToUI()

  // Load notes for tag lookup
  onProgress?.(10, 'Loading notes...')
  const notes: Note[] = await db.notes.toArray()
  const noteTagMap = new Map(notes.map(n => [n.id, n.tags]))
  await yieldToUI()

  // AC5: Dynamic import() for sql.js — keeps ~500KB off main bundle
  onProgress?.(15, 'Loading Anki export engine...')
  let initSqlJs: typeof import('sql.js').default
  try {
    // Use sql.js ASM build to avoid WASM binary file issues in production
    const sqlModule = await import('sql.js/dist/sql-asm.js')
    initSqlJs = sqlModule.default
  } catch (error) {
    throw new Error(
      `Anki export engine failed to load: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const SQL = await initSqlJs()
  await yieldToUI()

  onProgress?.(25, 'Creating Anki deck...')

  // Initialize SQLite database with Anki schema
  const sqlDb = new SQL.Database()
  try {
    sqlDb.run(createAnkiTemplate())

    const now = Date.now()

    // Get top-level deck and model IDs
    const topDeckId = now
    const topModelId = now + 1

    // Update deck name to "Knowlune Export"
    const decksRow = sqlDb.exec('SELECT decks FROM col')[0].values[0][0] as string
    const existingDecks = JSON.parse(decksRow) as Record<string, Record<string, unknown>>
    const deckKeys = Object.keys(existingDecks)
    const lastDeckKey = deckKeys[deckKeys.length - 1]
    const deckEntry = existingDecks[lastDeckKey]
    delete existingDecks[lastDeckKey]
    deckEntry.name = DECK_NAME
    deckEntry.id = topDeckId
    existingDecks[String(topDeckId)] = deckEntry
    sqlDb.run('UPDATE col SET decks=? WHERE id=1', [JSON.stringify(existingDecks)])

    // Update model
    const modelsRow = sqlDb.exec('SELECT models FROM col')[0].values[0][0] as string
    const existingModels = JSON.parse(modelsRow) as Record<string, Record<string, unknown>>
    const modelKeys = Object.keys(existingModels)
    const lastModelKey = modelKeys[modelKeys.length - 1]
    const modelEntry = existingModels[lastModelKey]
    delete existingModels[lastModelKey]
    modelEntry.name = DECK_NAME
    modelEntry.did = topDeckId
    modelEntry.id = topModelId
    existingModels[String(topModelId)] = modelEntry
    sqlDb.run('UPDATE col SET models=? WHERE id=1', [JSON.stringify(existingModels)])

    await yieldToUI()

    // Add cards
    onProgress?.(30, 'Adding flashcards to deck...')
    let cardIdCounter = now + 100
    let noteIdCounter = now + 100

    for (let i = 0; i < flashcards.length; i++) {
      const fc: Flashcard = flashcards[i]

      // AC3: Reuse deriveFlashcardTags() from E53-S01
      const tags = deriveFlashcardTags(fc, courseMap, noteTagMap)
      const strTags = tagsToAnkiString(tags)

      // Strip HTML from front/back (EC-HIGH: raw Tiptap HTML may include unwanted attributes)
      const front = stripHtml(fc.front)
      const back = stripHtml(fc.back)

      const fields = front + SEPARATOR + back

      // Generate unique IDs
      const noteGuid = await sha1Guid(`${topDeckId}${front}${back}`)
      const noteId = noteIdCounter++
      const cardId = cardIdCounter++
      const csum = await sha1Checksum(fields)
      const mod = Math.floor(now / 1000) + i

      // Insert note
      sqlDb.run(
        'INSERT OR REPLACE INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [noteId, noteGuid, topModelId, mod, -1, strTags, fields, front, csum, 0, '']
      )

      // Insert card
      sqlDb.run(
        'INSERT OR REPLACE INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [cardId, noteId, topDeckId, 0, mod, -1, 0, 0, 179, 0, 0, 0, 0, 0, 0, 0, 0, '']
      )

      // Progress + yield
      if (i % 20 === 0) {
        const percent = 30 + Math.round((i / flashcards.length) * 60)
        onProgress?.(percent, `Adding flashcard ${i + 1}/${flashcards.length}...`)
        await yieldToUI()
      }
    }

    onProgress?.(90, 'Generating .apkg file...')

    // Export SQLite DB as binary
    const binaryArray = sqlDb.export()

    // Create ZIP (apkg is just a ZIP with specific contents)
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('collection.anki2', binaryArray)
    zip.file('media', '{}')

    const blob = await zip.generateAsync({ type: 'blob' })
    onProgress?.(100, 'Complete')

    return blob
  } finally {
    sqlDb.close()
  }
}
