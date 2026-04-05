import { describe, it, expect } from 'vitest'
import {
  parseFilenameComponents,
  lcsLength,
  similarity,
  matchMaterialsToLessons,
  getCompanionMaterials,
  getCompanionPdfIds,
} from '../lessonMaterialMatcher'
import type { LessonItem } from '../courseAdapter'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeLesson(
  overrides: Partial<LessonItem> & { title: string }
): LessonItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title,
    type: overrides.type ?? 'video',
    order: overrides.order ?? 1,
    duration: overrides.duration,
    sourceMetadata: overrides.sourceMetadata,
  }
}

function makeVideo(title: string, order: number): LessonItem {
  return makeLesson({ title, type: 'video', order, id: `v-${order}` })
}

function makePdf(title: string, order: number): LessonItem {
  return makeLesson({ title, type: 'pdf', order, id: `p-${title}` })
}

// ---------------------------------------------------------------------------
// parseFilenameComponents
// ---------------------------------------------------------------------------

describe('parseFilenameComponents', () => {
  it('extracts simple numeric prefix and stem', () => {
    const result = parseFilenameComponents('01-FNL Replay - Drones Psyops.mp4')
    expect(result.numericPrefix).toBe('01')
    expect(result.stem).toBe('fnl replay drones psyops')
  })

  it('handles module-lesson prefix (01-01)', () => {
    const result = parseFilenameComponents('01-01 A Behavior Profiler Walks Into A Bar.pdf')
    expect(result.numericPrefix).toBe('01-01')
    expect(result.stem).toBe('a behavior profiler walks into a bar')
  })

  it('handles no numeric prefix', () => {
    const result = parseFilenameComponents('Resources.pdf')
    expect(result.numericPrefix).toBeNull()
    expect(result.stem).toBe('resources')
  })

  it('handles underscores in filenames', () => {
    const result = parseFilenameComponents('01-Drones_Psyops.pdf')
    expect(result.numericPrefix).toBe('01')
    expect(result.stem).toBe('drones psyops')
  })

  it('handles dot-separated prefix', () => {
    const result = parseFilenameComponents('05. Trade Zella.pdf')
    expect(result.numericPrefix).toBe('05')
    expect(result.stem).toBe('trade zella')
  })

  it('preserves original filename', () => {
    const result = parseFilenameComponents('01-FNL Replay.mp4')
    expect(result.originalFilename).toBe('01-FNL Replay.mp4')
  })

  it('handles uppercase filenames', () => {
    const result = parseFilenameComponents('01-CHASE_HUGHES_BASIC_NEUROLOGY.pdf')
    expect(result.numericPrefix).toBe('01')
    expect(result.stem).toBe('chase hughes basic neurology')
  })

  it('extracts sectionPrefix as first segment of compound prefix', () => {
    const result = parseFilenameComponents('01-01- Communication Laws.mp4')
    expect(result.numericPrefix).toBe('01-01')
    expect(result.sectionPrefix).toBe('01')
  })

  it('sectionPrefix equals numericPrefix for simple prefixes', () => {
    const result = parseFilenameComponents('01-Behavior_Flight_Manual.pdf')
    expect(result.numericPrefix).toBe('01')
    expect(result.sectionPrefix).toBe('01')
  })

  it('sectionPrefix is null when no prefix', () => {
    const result = parseFilenameComponents('Resources.pdf')
    expect(result.sectionPrefix).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// LCS and similarity
// ---------------------------------------------------------------------------

describe('lcsLength', () => {
  it('returns 0 for empty strings', () => {
    expect(lcsLength('', '')).toBe(0)
    expect(lcsLength('abc', '')).toBe(0)
  })

  it('returns 0 when first argument is empty (symmetry)', () => {
    expect(lcsLength('', 'abc')).toBe(0)
  })

  it('returns full length for identical strings', () => {
    expect(lcsLength('abc', 'abc')).toBe(3)
  })

  it('finds common subsequence', () => {
    expect(lcsLength('drones psyops', 'fnl replay drones psyops')).toBe(13)
  })
})

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('abc', 'abc')).toBe(1)
  })

  it('returns 0 for completely different strings', () => {
    expect(similarity('abc', 'xyz')).toBe(0)
  })

  it('returns high similarity for substrings', () => {
    const score = similarity('drones psyops', 'fnl replay drones psyops')
    expect(score).toBeGreaterThan(0.5)
  })

  it('returns exactly 0.5 at the threshold boundary', () => {
    // "ab" vs "axbx": LCS("ab","axbx") = 2, max(2,4) = 4 → 2/4 = 0.5
    expect(similarity('ab', 'axbx')).toBe(0.5)
  })

  it('returns below 0.5 when LCS ratio is insufficient', () => {
    // "ab" vs "axbxc": LCS("ab","axbxc") = 2, max(2,5) = 5 → 2/5 = 0.4
    expect(similarity('ab', 'axbxc')).toBeLessThan(0.5)
  })
})

// ---------------------------------------------------------------------------
// matchMaterialsToLessons
// ---------------------------------------------------------------------------

describe('matchMaterialsToLessons', () => {
  it('returns video-only groups when no PDFs', () => {
    const videos = [makeVideo('01-Intro.mp4', 1), makeVideo('02-Setup.mp4', 2)]
    const groups = matchMaterialsToLessons(videos, [])

    expect(groups).toHaveLength(2)
    expect(groups[0].primary.title).toBe('01-Intro.mp4')
    expect(groups[0].materials).toHaveLength(0)
  })

  it('matches PDFs by exact stem (Tier 1)', () => {
    const videos = [makeVideo('01-FNL Replay - Drones Psyops.mp4', 1)]
    const pdfs = [makePdf('01-FNL Replay - Drones Psyops.pdf', 1)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups).toHaveLength(1)
    expect(groups[0].primary.type).toBe('video')
    expect(groups[0].materials).toHaveLength(1)
    expect(groups[0].materials[0].title).toBe('01-FNL Replay - Drones Psyops.pdf')
  })

  it('matches PDFs by prefix + similarity (Tier 2)', () => {
    const videos = [makeVideo('01-FNL Replay - Drones Psyops.mp4', 1)]
    const pdfs = [makePdf('01-Drones_Psyops.pdf', 1)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups).toHaveLength(1)
    expect(groups[0].materials).toHaveLength(1)
  })

  it('matches PDFs by prefix only when single video at prefix (Tier 3)', () => {
    const videos = [makeVideo('01-Advanced Techniques.mp4', 1)]
    const pdfs = [makePdf('01-Worksheet.pdf', 1)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups).toHaveLength(1)
    expect(groups[0].materials).toHaveLength(1)
    expect(groups[0].materials[0].title).toBe('01-Worksheet.pdf')
  })

  it('does NOT match by prefix when multiple videos share prefix', () => {
    const videos = [
      makeVideo('01-01 Intro.mp4', 1),
      makeVideo('01-02 Setup.mp4', 2),
    ]
    // This PDF has prefix "01" but does NOT match "01-01" or "01-02" prefix
    // Since its prefix is just "01" and there are 2 videos with prefix "01-01"/"01-02",
    // the prefixes differ so Tier 3 won't match
    const pdfs = [makePdf('01-General Resources.pdf', 1)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    // PDF should be standalone since prefixes don't match
    const standalone = groups.find(g => g.primary.type === 'pdf')
    expect(standalone).toBeDefined()
    expect(standalone!.primary.title).toBe('01-General Resources.pdf')
  })

  it('matches module-lesson format', () => {
    const videos = [makeVideo('01-01 A Behavior Profiler.mp4', 1)]
    const pdfs = [makePdf('01-01 A Behavior Profiler.pdf', 1)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups).toHaveLength(1)
    expect(groups[0].materials).toHaveLength(1)
  })

  it('handles multiple PDFs per video', () => {
    const videos = [makeVideo('01-FNL Replay - Drones Psyops.mp4', 1)]
    const pdfs = [
      makePdf('01-FNL Replay - Drones Psyops.pdf', 1),
      makePdf('01-Drones_Psyops.pdf', 1),
    ]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups).toHaveLength(1)
    expect(groups[0].materials).toHaveLength(2)
  })

  it('creates standalone groups for unmatched PDFs', () => {
    const videos = [makeVideo('01-Intro.mp4', 1)]
    const pdfs = [makePdf('Resources.pdf', Infinity)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups).toHaveLength(2)
    const standalone = groups.find(g => g.primary.title === 'Resources.pdf')
    expect(standalone).toBeDefined()
    expect(standalone!.materials).toHaveLength(0)
  })

  it('sorts groups by primary lesson order', () => {
    const videos = [
      makeVideo('02-Advanced.mp4', 2),
      makeVideo('01-Intro.mp4', 1),
    ]
    const pdfs = [
      makePdf('02-Advanced.pdf', 2),
      makePdf('01-Intro.pdf', 1),
    ]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups[0].primary.title).toBe('01-Intro.mp4')
    expect(groups[1].primary.title).toBe('02-Advanced.mp4')
  })

  it('matches PDF section prefix to video compound prefix (Tier 5)', () => {
    // Real pattern from Chase Hughes course:
    // Videos use "01-01-" format, PDFs use "01-" format
    const videos = [
      makeVideo('01-01- Communication Laws of Human Behavior.mp4', 1),
      makeVideo('02-02- Composure Confidence and Scripts.mp4', 2),
      makeVideo('03-03- Confidence Strengths and Weaknesses.mp4', 3),
      makeVideo('04-04- Discipline Habits and Traits.mp4', 4),
      makeVideo('05-05- Authority Triangle and Strengths Finder.mp4', 5),
      makeVideo('06-06- Overcoming Anxiety and Master Basics.mp4', 6),
    ]
    const pdfs = [
      makePdf('01-Behavior_Flight_Manual_-_Authority.pdf', 1),
      makePdf('03-The_Hughes-Authority-Assessment.pdf', 3),
      makePdf('05-Leakage_Tracker_-_2020_blank.pdf', 5),
      makePdf('07-07- Resources.pdf', 7),
      makePdf('07-The_Hughes_Authority_Behavior_Inv.pdf', 7),
      makePdf('07-Authority_Course_Cards.pdf', 7),
    ]

    const groups = matchMaterialsToLessons(videos, pdfs)

    // Section 01: video + 1 PDF
    const sec01 = groups.find(g => g.primary.id === 'v-1')!
    expect(sec01.materials).toHaveLength(1)
    expect(sec01.materials[0].title).toBe('01-Behavior_Flight_Manual_-_Authority.pdf')

    // Section 03: video + 1 PDF
    const sec03 = groups.find(g => g.primary.id === 'v-3')!
    expect(sec03.materials).toHaveLength(1)
    expect(sec03.materials[0].title).toBe('03-The_Hughes-Authority-Assessment.pdf')

    // Section 05: video + 1 PDF
    const sec05 = groups.find(g => g.primary.id === 'v-5')!
    expect(sec05.materials).toHaveLength(1)
    expect(sec05.materials[0].title).toBe('05-Leakage_Tracker_-_2020_blank.pdf')

    // Section 07: no video, 3 standalone PDFs
    const sec07pdfs = groups.filter(
      g => g.primary.type === 'pdf' && g.primary.title.startsWith('07-')
    )
    expect(sec07pdfs).toHaveLength(3)
  })

  it('matches via Tier 4 (section prefix + similarity) when full prefixes differ', () => {
    // Video has compound prefix "01-01" (section "01"), PDF has prefix "01" (section "01").
    // Full prefixes differ ("01-01" vs "01"), so Tiers 1-3 won't match.
    // Section prefixes match ("01" === "01") and stems share high similarity,
    // so Tier 4 should pair the PDF with the video.
    const videos = [makeVideo('01-01- Communication Laws.mp4', 1)]
    const pdfs = [makePdf('01-Communication_Laws.pdf', 1)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups).toHaveLength(1)
    expect(groups[0].primary.type).toBe('video')
    expect(groups[0].materials).toHaveLength(1)
    expect(groups[0].materials[0].title).toBe('01-Communication_Laws.pdf')
  })

  it('does NOT match via Tier 4 when similarity is below 0.5 threshold', () => {
    // Section prefixes match ("01") but stems are completely different,
    // so similarity is below 0.5 and Tier 4 should not match.
    const videos = [
      makeVideo('01-01- Communication Laws.mp4', 1),
      makeVideo('01-02- Body Language Basics.mp4', 2),
    ]
    const pdfs = [makePdf('01-Zebra_Quantum_Physics.pdf', 1)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    // PDF should be standalone (unmatched) — two videos share section "01"
    // and neither stem is similar to "zebra quantum physics"
    const standalone = groups.find(
      g => g.primary.type === 'pdf' && g.primary.title === '01-Zebra_Quantum_Physics.pdf'
    )
    expect(standalone).toBeDefined()
    expect(standalone!.materials).toHaveLength(0)
  })

  it('is case insensitive', () => {
    const videos = [makeVideo('01-CHASE_HUGHES_BASIC_NEUROLOGY.mp4', 1)]
    const pdfs = [makePdf('01-Chase_Hughes_Basic_Neurology.pdf', 1)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups).toHaveLength(1)
    expect(groups[0].materials).toHaveLength(1)
  })

  it('handles empty inputs', () => {
    expect(matchMaterialsToLessons([], [])).toEqual([])
    expect(matchMaterialsToLessons([], [makePdf('01-Intro.pdf', 1)])).toHaveLength(1)
  })

  it('interleaves standalone PDFs by order among video groups', () => {
    const videos = [
      makeVideo('01-FNL Replay.mp4', 1),
      makeVideo('03-Advanced.mp4', 3),
    ]
    const pdfs = [makePdf('02-Start Here.pdf', 2)]

    const groups = matchMaterialsToLessons(videos, pdfs)

    expect(groups).toHaveLength(3)
    expect(groups[0].primary.order).toBe(1)
    expect(groups[1].primary.order).toBe(2)
    expect(groups[2].primary.order).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe('getCompanionMaterials', () => {
  it('returns materials for a matching lesson', () => {
    const videos = [makeVideo('01-Intro.mp4', 1)]
    const pdfs = [makePdf('01-Intro.pdf', 1)]
    const groups = matchMaterialsToLessons(videos, pdfs)

    const materials = getCompanionMaterials('v-1', groups)
    expect(materials).toHaveLength(1)
  })

  it('returns empty array for non-matching lesson', () => {
    const videos = [makeVideo('01-Intro.mp4', 1)]
    const groups = matchMaterialsToLessons(videos, [])

    expect(getCompanionMaterials('nonexistent', groups)).toEqual([])
  })
})

describe('getCompanionPdfIds', () => {
  it('collects all companion PDF IDs', () => {
    const videos = [
      makeVideo('01-Intro.mp4', 1),
      makeVideo('02-Setup.mp4', 2),
    ]
    const pdfs = [
      makePdf('01-Intro.pdf', 1),
      makePdf('02-Setup.pdf', 2),
    ]

    const groups = matchMaterialsToLessons(videos, pdfs)
    const ids = getCompanionPdfIds(groups)

    expect(ids.size).toBe(2)
    expect(ids.has('p-01-Intro.pdf')).toBe(true)
    expect(ids.has('p-02-Setup.pdf')).toBe(true)
  })
})
