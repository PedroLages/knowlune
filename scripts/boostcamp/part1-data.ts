/**
 * MHRP Part 1 — Foundation & Hypertrophy (Weeks 1–11)
 *
 * Phase 1: Re-Entry (Weeks 1–4) — Rebuild the Foundation
 * Phase 2: Hypertrophy Block 1 (Weeks 5–10) — Volume Accumulation
 * Phase 3: Deload (Week 11) — Strategic Recovery
 *
 * Source: docs/planning-artifacts/research/domain-hypertrophy-program-masters-lifter-research-2026-02-27.md
 */

// ─── Types ───────────────────────────────────────────────

export interface Exercise {
  /** Display name from research doc */
  name: string
  /** What to type in Boostcamp's exercise search */
  search: string
  /** Expected Boostcamp match (for verification) */
  expected?: string
  /** Number of working sets */
  sets: number
  /** Rep prescription (e.g., "10", "6-8", "max-2") */
  reps: string
  /** RPE target (e.g., "7-8", "8", "9") */
  rpe?: string
  /** Rest period (e.g., "2 min", "90s", "60s") */
  rest?: string
}

export interface Day {
  name: string
  exercises: Exercise[]
}

export interface Week {
  weekNumber: number
  phase: string
  days: Day[]
  /** If this week can be created by copying another week */
  copyFrom?: number
  /** Notes about what differs from the source week */
  copyNotes?: string
}

export interface Program {
  name: string
  totalWeeks: number
  weeks: Week[]
}

// ─── Exercise Search Mappings ────────────────────────────
// Maps research doc names → Boostcamp search terms

const EX = {
  // Upper body - Push
  benchPress: { search: 'Bench Press', expected: 'Bench Press (Barbell)' },
  inclineDBPress: { search: 'Incline Dumbbell Press', expected: 'Incline Dumbbell Press' },
  flatDBPress: { search: 'Dumbbell Bench Press', expected: 'Dumbbell Bench Press' },
  dbShoulderPress: { search: 'Shoulder Press', expected: 'Dumbbell Shoulder Press' },
  lateralRaise: { search: 'Lateral Raise', expected: 'Lateral Raise' },
  tricepPushdown: { search: 'Tricep Pushdown', expected: 'Tricep Pushdown' },
  overheadTricepExt: { search: 'Overhead Tricep', expected: 'Overhead Tricep Extension' },
  facePull: { search: 'Face Pull', expected: 'Face Pull' },
  bandPullApart: { search: 'Band Pull Apart', expected: 'Band Pull Apart' },

  // Upper body - Pull
  pullUp: { search: 'Pull Up', expected: 'Pull Up' },
  seatedCableRow: { search: 'Seated Cable Row', expected: 'Seated Cable Row' },
  cableLatPulldown: { search: 'Lat Pulldown', expected: 'Lat Pulldown (Cable)' },
  chestSupportedRow: { search: 'Chest Supported Row', expected: 'Chest Supported Row' },
  ezBarCurl: { search: 'EZ Bar Curl', expected: 'EZ Bar Curl' },
  inclineDBCurl: { search: 'Incline Dumbbell Curl', expected: 'Incline Dumbbell Curl' },
  hammerCurl: { search: 'Hammer Curl', expected: 'Hammer Curl' },

  // Lower body
  legPress: { search: 'Leg Press', expected: 'Leg Press' },
  romanianDeadlift: { search: 'Romanian Deadlift', expected: 'Romanian Deadlift' },
  conventionalDeadlift: { search: 'Deadlift', expected: 'Deadlift (Conventional)' },
  legExtension: { search: 'Leg Extension', expected: 'Leg Extension' },
  seatedLegCurl: { search: 'Seated Leg Curl', expected: 'Seated Leg Curl' },
  lyingLegCurl: { search: 'Lying Leg Curl', expected: 'Lying Leg Curl' },
  bulgarianSplitSquat: { search: 'Bulgarian Split Squat', expected: 'Bulgarian Split Squat' },
  hipThrust: { search: 'Hip Thrust', expected: 'Hip Thrust' },
  standingCalfRaise: { search: 'Standing Calf Raise', expected: 'Standing Calf Raise' },
  seatedCalfRaise: { search: 'Seated Calf Raise', expected: 'Seated Calf Raise' },
  hackSquat: { search: 'Hack Squat', expected: 'Hack Squat' },

  // Mobility (may need "Create New Exercise")
  hip9090: { search: 'Hip 90/90', expected: undefined },
  ankleDorsiflexion: { search: 'Ankle Dorsiflexion', expected: undefined },
} as const

// ─── Helper to build Exercise objects ────────────────────

function ex(
  name: string,
  mapping: { search: string; expected?: string },
  sets: number,
  reps: string,
  rpe?: string,
  rest?: string,
): Exercise {
  return { name, search: mapping.search, expected: mapping.expected, sets, reps, rpe, rest }
}

// ─── Phase 1: Re-Entry (Weeks 1–4) ──────────────────────
// Same exercises each week, but sets/reps progress:
// Week 1: 2 sets, @50% | Week 2: 2 sets, @60% | Week 3: 3 sets, @70% | Week 4: 3 sets, @75%
// All exercises use 3-1-2 tempo

function phase1Week(weekNum: 1 | 2 | 3 | 4): Week {
  const isLight = weekNum <= 2
  const mainSets = isLight ? 2 : 3
  const accessorySets = isLight ? 2 : 3
  // Main compound reps vary by exercise
  const mainUpperReps = isLight ? '10' : '8'
  const mainLowerReps = isLight ? '12' : '10'
  const deadliftReps = isLight ? '8' : '6'
  const accessoryReps12 = isLight ? '12' : '10'
  const accessoryReps15 = isLight ? '15' : '12'
  const percentLabel = ['50%', '60%', '70%', '75%'][weekNum - 1]

  return {
    weekNumber: weekNum,
    phase: `Phase 1: Re-Entry (${percentLabel})`,
    copyFrom: weekNum > 1 ? 1 : undefined,
    copyNotes: weekNum > 1 ? `Change sets/reps to match ${percentLabel} progression` : undefined,
    days: [
      // Day 1: Upper A (Push Emphasis)
      {
        name: 'Upper A (Push)',
        exercises: [
          ex('Flat Barbell Bench Press', EX.benchPress, mainSets, mainUpperReps, undefined, '2 min'),
          ex('Incline Dumbbell Press', EX.inclineDBPress, mainSets, accessoryReps12, undefined, '90s'),
          ex('Seated Cable Row', EX.seatedCableRow, mainSets, accessoryReps12, undefined, '90s'),
          ex('Lateral Raise', EX.lateralRaise, mainSets, accessoryReps15, undefined, '60s'),
          ex('Tricep Pushdown', EX.tricepPushdown, mainSets, accessoryReps15, undefined, '60s'),
          ex('Face Pull', EX.facePull, 2, '15', undefined, '60s'),
        ],
      },
      // Day 2: Lower A (Quad Emphasis)
      {
        name: 'Lower A (Quad)',
        exercises: [
          ex('Leg Press', EX.legPress, mainSets, mainLowerReps, undefined, '2 min'),
          ex('Romanian Deadlift', EX.romanianDeadlift, mainSets, mainUpperReps, undefined, '2 min'),
          ex('Leg Extension', EX.legExtension, mainSets, accessoryReps15, undefined, '60s'),
          ex('Seated Leg Curl', EX.seatedLegCurl, mainSets, accessoryReps12, undefined, '60s'),
          ex('Standing Calf Raise', EX.standingCalfRaise, mainSets, accessoryReps15, undefined, '60s'),
          ex('Hip 90/90 Stretch', EX.hip9090, 2, '8/side', undefined, '—'),
        ],
      },
      // Day 3: Upper B (Pull Emphasis)
      {
        name: 'Upper B (Pull)',
        exercises: [
          ex('Pull-Ups (or Assisted)', EX.pullUp, mainSets, 'max-2', undefined, '2 min'),
          ex('Flat Dumbbell Bench Press', EX.flatDBPress, mainSets, accessoryReps12, undefined, '90s'),
          ex('Cable Lat Pulldown', EX.cableLatPulldown, mainSets, accessoryReps12, undefined, '90s'),
          ex('Dumbbell Shoulder Press', EX.dbShoulderPress, mainSets, accessoryReps12, undefined, '90s'),
          ex('EZ-Bar Curl', EX.ezBarCurl, mainSets, accessoryReps12, undefined, '60s'),
          ex('Band Pull-Apart', EX.bandPullApart, 2, '15', undefined, '60s'),
        ],
      },
      // Day 4: Lower B (Posterior Chain Emphasis)
      {
        name: 'Lower B (Posterior)',
        exercises: [
          ex('Conventional Deadlift', EX.conventionalDeadlift, mainSets, deadliftReps, undefined, '2.5 min'),
          ex('Bulgarian Split Squat', EX.bulgarianSplitSquat, mainSets, `${mainUpperReps}/leg`, undefined, '90s'),
          ex('Hip Thrust', EX.hipThrust, mainSets, accessoryReps12, undefined, '90s'),
          ex('Lying Leg Curl', EX.lyingLegCurl, mainSets, accessoryReps12, undefined, '60s'),
          ex('Seated Calf Raise', EX.seatedCalfRaise, mainSets, accessoryReps15, undefined, '60s'),
          ex('Ankle Dorsiflexion Mob.', EX.ankleDorsiflexion, 2, '30s/side', undefined, '—'),
        ],
      },
    ],
  }
}

// ─── Phase 2: Hypertrophy Block 1 (Weeks 5–10) ──────────
// Volume ramp: 3 sets → 4 sets over the 6 weeks
// Arrow notation: start at lower set count in week 5, add 1 set every 2 weeks

function phase2Week(weekNum: 5 | 6 | 7 | 8 | 9 | 10): Week {
  // Volume ramp: weeks 5-6 = base sets, weeks 7-8 = +1 set on compounds, weeks 9-10 = +1 set on all
  const rampStage = weekNum <= 6 ? 0 : weekNum <= 8 ? 1 : 2
  const compoundSets = 3 + (rampStage >= 1 ? 1 : 0) // 3 → 4
  const accessorySets = 3 + (rampStage >= 2 ? 1 : 0) // 3 → 4
  const isolationSets = 3 + (rampStage >= 2 ? 1 : 0) // 3 → 4

  return {
    weekNumber: weekNum,
    phase: `Phase 2: Hypertrophy Block 1 (Volume ${rampStage === 0 ? 'Base' : rampStage === 1 ? 'Ramp' : 'Peak'})`,
    copyFrom: weekNum > 5 ? 5 : undefined,
    copyNotes:
      weekNum > 5 ? `Adjust set counts: compounds=${compoundSets}, accessories=${accessorySets}` : undefined,
    days: [
      // Day 1: Upper A (Push Emphasis)
      {
        name: 'Upper A (Push)',
        exercises: [
          ex('Flat Barbell Bench Press', EX.benchPress, compoundSets, '6-8', '7-8', '2.5 min'),
          ex('Incline Dumbbell Press', EX.inclineDBPress, compoundSets, '8-10', '8', '90s'),
          ex('Chest-Supported Row', EX.chestSupportedRow, compoundSets, '8-10', '8', '90s'),
          ex('Lateral Raise', EX.lateralRaise, isolationSets, '12-15', '8-9', '60s'),
          ex('Overhead Tricep Extension', EX.overheadTricepExt, 3, '10-12', '8-9', '60s'),
          ex('Face Pull', EX.facePull, 2, '15-20', '7', '60s'),
        ],
      },
      // Day 2: Lower A (Quad Emphasis)
      {
        name: 'Lower A (Quad)',
        exercises: [
          ex('Leg Press', EX.legPress, compoundSets, '8-10', '7-8', '2.5 min'),
          ex('Romanian Deadlift', EX.romanianDeadlift, compoundSets, '8-10', '7-8', '2 min'),
          ex('Hack Squat', EX.hackSquat, 3, '10-12', '8', '90s'),
          ex('Leg Extension', EX.legExtension, isolationSets, '12-15', '8-9', '60s'),
          ex('Seated Leg Curl', EX.seatedLegCurl, accessorySets, '10-12', '8-9', '60s'),
          ex('Standing Calf Raise', EX.standingCalfRaise, 3, '10-15', '8-9', '60s'),
        ],
      },
      // Day 3: Upper B (Pull Emphasis)
      {
        name: 'Upper B (Pull)',
        exercises: [
          ex('Pull-Ups (weighted if possible)', EX.pullUp, compoundSets, '5-8', '7-8', '2.5 min'),
          ex('Flat Dumbbell Bench Press', EX.flatDBPress, compoundSets, '8-10', '8', '90s'),
          ex('Cable Row (close grip)', EX.seatedCableRow, accessorySets, '10-12', '8', '90s'),
          ex('Dumbbell Shoulder Press', EX.dbShoulderPress, 3, '8-10', '8', '90s'),
          ex('Incline Dumbbell Curl', EX.inclineDBCurl, 3, '10-12', '8-9', '60s'),
          ex('Hammer Curl', EX.hammerCurl, 2, '12-15', '8-9', '60s'),
        ],
      },
      // Day 4: Lower B (Posterior Chain Emphasis)
      {
        name: 'Lower B (Posterior)',
        exercises: [
          ex('Conventional Deadlift', EX.conventionalDeadlift, compoundSets, '5-6', '7-8', '3 min'),
          ex('Bulgarian Split Squat', EX.bulgarianSplitSquat, compoundSets, '8-10/leg', '8', '90s'),
          ex('Hip Thrust', EX.hipThrust, accessorySets, '8-12', '8-9', '90s'),
          ex('Lying Leg Curl', EX.lyingLegCurl, 3, '10-12', '8-9', '60s'),
          ex('Seated Calf Raise', EX.seatedCalfRaise, 3, '12-15', '8-9', '60s'),
        ],
      },
    ],
  }
}

// ─── Phase 3: Deload (Week 11) ──────────────────────────
// 50% volume (2 sets per exercise), RPE 5-6, 3 sessions (skip one lower day)

function phase3Deload(): Week {
  return {
    weekNumber: 11,
    phase: 'Phase 3: Deload — Strategic Recovery',
    days: [
      {
        name: 'Upper A (Deload)',
        exercises: [
          ex('Flat Barbell Bench Press', EX.benchPress, 2, '8', '5-6', '2 min'),
          ex('Incline Dumbbell Press', EX.inclineDBPress, 2, '10', '5-6', '90s'),
          ex('Chest-Supported Row', EX.chestSupportedRow, 2, '10', '5-6', '90s'),
          ex('Lateral Raise', EX.lateralRaise, 2, '12', '5-6', '60s'),
          ex('Face Pull', EX.facePull, 2, '15', '5', '60s'),
        ],
      },
      {
        name: 'Lower A (Deload)',
        exercises: [
          ex('Leg Press', EX.legPress, 2, '10', '5-6', '2 min'),
          ex('Romanian Deadlift', EX.romanianDeadlift, 2, '8', '5-6', '2 min'),
          ex('Leg Extension', EX.legExtension, 2, '12', '5-6', '60s'),
          ex('Seated Leg Curl', EX.seatedLegCurl, 2, '10', '5-6', '60s'),
          ex('Standing Calf Raise', EX.standingCalfRaise, 2, '12', '5-6', '60s'),
        ],
      },
      {
        name: 'Upper B (Deload)',
        exercises: [
          ex('Pull-Ups', EX.pullUp, 2, '5', '5-6', '2 min'),
          ex('Flat Dumbbell Bench Press', EX.flatDBPress, 2, '10', '5-6', '90s'),
          ex('Cable Row', EX.seatedCableRow, 2, '10', '5-6', '90s'),
          ex('Dumbbell Shoulder Press', EX.dbShoulderPress, 2, '8', '5-6', '90s'),
          ex('EZ-Bar Curl', EX.ezBarCurl, 2, '10', '5-6', '60s'),
        ],
      },
    ],
  }
}

// ─── Complete Part 1 Program ─────────────────────────────

export const mhrpPart1: Program = {
  name: 'MHRP Part 1 — Foundation & Hypertrophy',
  totalWeeks: 11,
  weeks: [
    // Phase 1: Re-Entry (Weeks 1–4)
    phase1Week(1),
    phase1Week(2),
    phase1Week(3),
    phase1Week(4),
    // Phase 2: Hypertrophy Block 1 (Weeks 5–10)
    phase2Week(5),
    phase2Week(6),
    phase2Week(7),
    phase2Week(8),
    phase2Week(9),
    phase2Week(10),
    // Phase 3: Deload (Week 11)
    phase3Deload(),
  ],
}

// ─── Quick summary for verification ─────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`\nProgram: ${mhrpPart1.name}`)
  console.log(`Total weeks: ${mhrpPart1.totalWeeks}\n`)
  for (const week of mhrpPart1.weeks) {
    const copyInfo = week.copyFrom ? ` (copy from Week ${week.copyFrom})` : ''
    console.log(`Week ${week.weekNumber}: ${week.phase}${copyInfo}`)
    for (const day of week.days) {
      console.log(`  ${day.name}: ${day.exercises.length} exercises`)
      for (const exercise of day.exercises) {
        console.log(`    - ${exercise.name}: ${exercise.sets}x${exercise.reps} ${exercise.rpe ? `RPE ${exercise.rpe}` : ''}`)
      }
    }
  }
}
