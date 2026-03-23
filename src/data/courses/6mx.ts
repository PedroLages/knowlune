import type { Course } from '@/data/types'

const BASE = '/Volumes/SSD/GFX/Chase Hughes - The Operative Kit/04-6-Minute X-Ray 6MX'

export const sixMinuteXRay: Course = {
  id: '6mx',
  title: '6-Minute X-Ray (6MX) Behavior Course',
  shortTitle: '6-Minute X-Ray',
  description:
    'A 5-day intensive behavioral analysis course covering human communication, eye behavior, facial reading, suggestibility, deception detection, elicitation methods, the Six-Axis Model, human needs mapping, neuropeptides, the Six Pillars, the Hughes Quadrant, the Behavior Compass, de-escalation, and consistency hacking.',
  category: 'behavioral-analysis',
  difficulty: 'intermediate',
  totalLessons: 31,
  totalVideos: 28,
  totalPDFs: 15,
  estimatedHours: 32,
  isSequential: true,
  basePath: BASE,
  coverImage: '/images/6mx',
  authorId: 'chase-hughes',
  tags: [
    'behavioral-analysis',
    'deception-detection',
    'body-language',
    'elicitation',
    'six-axis-model',
    'behavior-compass',
    'human-needs',
    'de-escalation',
    'influence',
  ],
  modules: [
    // ──────────────────────────────────────────────
    // Module 1 — Welcome
    // ──────────────────────────────────────────────
    {
      id: '6mx-welcome',
      title: 'Welcome to 6-Minute X-Ray',
      description:
        'Course introduction and overview of the 6-Minute X-Ray behavioral analysis system.',
      order: 1,
      lessons: [
        {
          id: '6mx-welcome-intro',
          title: 'Introduction',
          description:
            'Welcome and orientation to the 6-Minute X-Ray behavior course, outlining the 5-day structure and learning objectives.',
          order: 1,
          duration: '1h',
          keyTopics: ['course-overview', '6mx-methodology', 'learning-path'],
          resources: [
            {
              id: '6mx-welcome-intro-video',
              title: 'Introduction',
              type: 'video',
              filePath: `${BASE}/01-Welcome to 6-Minute X-Ray/01-00- Introduction.mp4`,
              fileName: '01-00- Introduction.mp4',
            },
            {
              id: '6mx-welcome-intro-pdf',
              title: 'Introduction Handout',
              type: 'pdf',
              filePath: `${BASE}/01-Welcome to 6-Minute X-Ray/01-00- Introduction.pdf`,
              fileName: '01-00- Introduction.pdf',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Module 2 — Day One
    // ──────────────────────────────────────────────
    {
      id: '6mx-day1',
      title: 'The 6MX Behavior Course Day One',
      description:
        'Foundations of human communication, behavioral laws, points of failure, the Behavioral Table of Elements, and eye behavior analysis.',
      order: 2,
      lessons: [
        {
          id: '6mx-day1-human-comm',
          title: 'Human Communication',
          description:
            'Fundamentals of human communication and how behavioral signals are transmitted and received.',
          order: 1,
          duration: '1h',
          keyTopics: ['human-communication', 'behavioral-signals', 'nonverbal-cues'],
          resources: [
            {
              id: '6mx-day1-human-comm-video',
              title: 'Human Communication',
              type: 'video',
              filePath: `${BASE}/02-The 6MX Behavior Course Day One/01-01- Human Communication.mp4`,
              fileName: '01-01- Human Communication.mp4',
            },
            {
              id: '6mx-day1-human-comm-pdf',
              title: 'Human Communication Handout',
              type: 'pdf',
              filePath: `${BASE}/02-The 6MX Behavior Course Day One/01-01- Human Communication.pdf`,
              fileName: '01-01- Human Communication.pdf',
            },
            {
              id: '6mx-day1-handout',
              title: '6MX Day 1 Handout',
              type: 'pdf',
              filePath: `${BASE}/02-The 6MX Behavior Course Day One/01-6MX_Handout_Day_1.pdf`,
              fileName: '01-6MX_Handout_Day_1.pdf',
            },
            {
              id: '6mx-day1-bte-mom-edition',
              title: '2024 Mom Edition BTE Final',
              type: 'pdf',
              filePath: `${BASE}/02-The 6MX Behavior Course Day One/01-2024_Mom_Edition_BTE_Final.pdf`,
              fileName: '01-2024_Mom_Edition_BTE_Final.pdf',
            },
          ],
        },
        {
          id: '6mx-day1-laws',
          title: 'Laws of Human Behavior',
          description:
            'Core behavioral laws that govern human interaction and predictable behavioral patterns.',
          order: 2,
          duration: '1h',
          keyTopics: ['behavioral-laws', 'predictive-patterns', 'human-behavior'],
          resources: [
            {
              id: '6mx-day1-laws-video',
              title: 'Laws of Human Behavior',
              type: 'video',
              filePath: `${BASE}/02-The 6MX Behavior Course Day One/02-02- Laws of Human Behavior.mp4`,
              fileName: '02-02- Laws of Human Behavior.mp4',
            },
          ],
        },
        {
          id: '6mx-day1-points-of-failure',
          title: 'Points of Failure',
          description:
            'Identifying critical points of failure in behavioral analysis and how to avoid common mistakes.',
          order: 3,
          duration: '1h',
          keyTopics: ['analysis-pitfalls', 'cognitive-bias', 'points-of-failure'],
          resources: [
            {
              id: '6mx-day1-points-of-failure-video',
              title: 'Points of Failure',
              type: 'video',
              filePath: `${BASE}/02-The 6MX Behavior Course Day One/03-03- Points of Failure.mp4`,
              fileName: '03-03- Points of Failure.mp4',
            },
          ],
        },
        {
          id: '6mx-day1-btoe',
          title: 'The Behavioral Table of Elements (BToE)',
          description:
            'Introduction to the Behavioral Table of Elements framework for categorizing and identifying behavioral indicators.',
          order: 4,
          duration: '1h',
          keyTopics: [
            'behavioral-table-of-elements',
            'behavior-classification',
            'indicator-framework',
          ],
          resources: [
            {
              id: '6mx-day1-btoe-video',
              title: 'The Behavioral Table of Elements BToE',
              type: 'video',
              filePath: `${BASE}/02-The 6MX Behavior Course Day One/04-04- The Behavioral Table of Elements BToE.mp4`,
              fileName: '04-04- The Behavioral Table of Elements BToE.mp4',
            },
          ],
        },
        {
          id: '6mx-day1-eyes',
          title: 'The Eyes',
          description:
            'Analyzing eye behavior as a primary source of behavioral information, including gaze patterns and pupil responses.',
          order: 5,
          duration: '1h',
          keyTopics: ['eye-behavior', 'gaze-patterns', 'pupil-response', 'ocular-indicators'],
          resources: [
            {
              id: '6mx-day1-eyes-video',
              title: 'The Eyes',
              type: 'video',
              filePath: `${BASE}/02-The 6MX Behavior Course Day One/05-05- The Eyes.mp4`,
              fileName: '05-05- The Eyes.mp4',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Module 3 — Day Two
    // ──────────────────────────────────────────────
    {
      id: '6mx-day2',
      title: 'The 6MX Behavior Course Day Two',
      description:
        'Advanced eye analysis with entrainment, facial reading, suggestibility assessment, body language, and introduction to deception detection.',
      order: 3,
      lessons: [
        {
          id: '6mx-day2-eyes-entrainment',
          title: 'The Eyes and Entrainment',
          description:
            'Advanced eye behavior analysis including entrainment techniques for reading subconscious responses.',
          order: 1,
          duration: '1h',
          keyTopics: ['eye-entrainment', 'subconscious-response', 'advanced-eye-analysis'],
          resources: [
            {
              id: '6mx-day2-eyes-entrainment-video',
              title: 'The Eyes and Entrainment',
              type: 'video',
              filePath: `${BASE}/03-The 6MX Behavior Course Day Two/01-06- The Eyes and Entrainment.mp4`,
              fileName: '01-06- The Eyes and Entrainment.mp4',
            },
            {
              id: '6mx-day2-eyes-entrainment-pdf',
              title: 'The Eyes and Entrainment Handout',
              type: 'pdf',
              filePath: `${BASE}/03-The 6MX Behavior Course Day Two/01-06- The Eyes and Entrainment.pdf`,
              fileName: '01-06- The Eyes and Entrainment.pdf',
            },
          ],
        },
        {
          id: '6mx-day2-face',
          title: 'The Face',
          description:
            'Reading facial expressions and micro-expressions for behavioral insight and emotional state identification.',
          order: 2,
          duration: '1h',
          keyTopics: ['facial-expressions', 'micro-expressions', 'emotional-state'],
          resources: [
            {
              id: '6mx-day2-face-video',
              title: 'The Face',
              type: 'video',
              filePath: `${BASE}/03-The 6MX Behavior Course Day Two/02-07- The Face.mp4`,
              fileName: '02-07- The Face.mp4',
            },
          ],
        },
        {
          id: '6mx-day2-suggestibility',
          title: 'Suggestibility',
          description:
            'Assessing and understanding individual suggestibility levels and how they affect behavioral responses.',
          order: 3,
          duration: '1h',
          keyTopics: ['suggestibility', 'influence-receptivity', 'psychological-profiling'],
          resources: [
            {
              id: '6mx-day2-suggestibility-video',
              title: 'Suggestibility',
              type: 'video',
              filePath: `${BASE}/03-The 6MX Behavior Course Day Two/03-08- Suggestibility.mp4`,
              fileName: '03-08- Suggestibility.mp4',
            },
          ],
        },
        {
          id: '6mx-day2-body',
          title: 'The Body',
          description:
            'Full-body behavioral analysis covering posture, gestures, orientation, and physical behavioral indicators.',
          order: 4,
          duration: '1h',
          keyTopics: [
            'body-language',
            'posture-analysis',
            'gesture-reading',
            'physical-indicators',
          ],
          resources: [
            {
              id: '6mx-day2-body-video',
              title: 'The Body',
              type: 'video',
              filePath: `${BASE}/03-The 6MX Behavior Course Day Two/04-09- The Body.mp4`,
              fileName: '04-09- The Body.mp4',
            },
          ],
        },
        {
          id: '6mx-day2-deception',
          title: 'Deception Detection',
          description:
            'Introduction to deception detection principles and identifying deceptive behavioral clusters.',
          order: 5,
          duration: '1h',
          keyTopics: ['deception-detection', 'behavioral-clusters', 'truth-vs-deception'],
          resources: [
            {
              id: '6mx-day2-deception-video',
              title: 'Deception Detection',
              type: 'video',
              filePath: `${BASE}/03-The 6MX Behavior Course Day Two/05-10- Deception Detection.mp4`,
              fileName: '05-10- Deception Detection.mp4',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Module 4 — Day Three
    // ──────────────────────────────────────────────
    {
      id: '6mx-day3',
      title: 'The 6MX Behavior Course Day Three',
      description:
        'Deep dive into deception behaviors, elicitation methods and techniques, and the Hughes Six-Axis Model for behavioral profiling.',
      order: 4,
      lessons: [
        {
          id: '6mx-day3-deception-part1',
          title: 'Deception Behaviors Part One',
          description:
            'Detailed examination of specific deception behaviors and how to identify them in real-time interactions.',
          order: 1,
          duration: '1h',
          keyTopics: ['deception-behaviors', 'behavioral-indicators', 'real-time-analysis'],
          resources: [
            {
              id: '6mx-day3-deception-part1-video',
              title: 'Deception Behaviors Part One',
              type: 'video',
              filePath: `${BASE}/04-The 6MX Behavior Course Day Three/01-11- Deception Behaviors Part One.mp4`,
              fileName: '01-11- Deception Behaviors Part One.mp4',
            },
          ],
        },
        {
          id: '6mx-day3-deception-part2',
          title: 'Deception Behaviors Part Two',
          description:
            'Continuation of deception behavior analysis with advanced detection patterns and contextual interpretation.',
          order: 2,
          duration: '1h',
          keyTopics: ['advanced-deception', 'detection-patterns', 'contextual-analysis'],
          resources: [
            {
              id: '6mx-day3-deception-part2-video',
              title: 'Deception Behaviors Part Two',
              type: 'video',
              filePath: `${BASE}/04-The 6MX Behavior Course Day Three/02-12- Deception Behaviors Part Two.mp4`,
              fileName: '02-12- Deception Behaviors Part Two.mp4',
            },
          ],
        },
        {
          id: '6mx-day3-elicitation-methods',
          title: 'Elicitation Methods',
          description:
            'Overview of elicitation methods for gathering information through conversational techniques without direct questioning.',
          order: 3,
          duration: '1h',
          keyTopics: ['elicitation', 'information-gathering', 'conversational-techniques'],
          resources: [
            {
              id: '6mx-day3-elicitation-methods-video',
              title: 'Elicitation Methods',
              type: 'video',
              filePath: `${BASE}/04-The 6MX Behavior Course Day Three/03-13- Elicitation Methods.mp4`,
              fileName: '03-13- Elicitation Methods.mp4',
            },
          ],
        },
        {
          id: '6mx-day3-elicitation-tech-part1',
          title: 'Elicitation Techniques Part One',
          description:
            'Practical elicitation techniques for extracting information through natural conversation patterns.',
          order: 4,
          duration: '1h',
          keyTopics: ['elicitation-techniques', 'practical-application', 'conversation-patterns'],
          resources: [
            {
              id: '6mx-day3-elicitation-tech-part1-video',
              title: 'Elicitation Techniques Part One',
              type: 'video',
              filePath: `${BASE}/04-The 6MX Behavior Course Day Three/04-14- Elicitation Techniques Part One.mp4`,
              fileName: '04-14- Elicitation Techniques Part One.mp4',
            },
          ],
        },
        {
          id: '6mx-day3-elicitation-tech-part2',
          title: 'Elicitation Techniques Part Two',
          description:
            'Advanced elicitation techniques including strategic questioning and rapport-based information extraction.',
          order: 5,
          duration: '1h',
          keyTopics: ['advanced-elicitation', 'strategic-questioning', 'rapport-techniques'],
          resources: [
            {
              id: '6mx-day3-elicitation-tech-part2-video',
              title: 'Elicitation Techniques Part Two',
              type: 'video',
              filePath: `${BASE}/04-The 6MX Behavior Course Day Three/05-15- Elicitation Techniques Part Two.mp4`,
              fileName: '05-15- Elicitation Techniques Part Two.mp4',
            },
          ],
        },
        {
          id: '6mx-day3-six-axis',
          title: 'The Hughes Six-Axis Model',
          description:
            'Introduction to the Hughes Six-Axis Model for comprehensive behavioral profiling across six key dimensions.',
          order: 6,
          duration: '1h',
          keyTopics: ['six-axis-model', 'behavioral-profiling', 'personality-dimensions'],
          resources: [
            {
              id: '6mx-day3-six-axis-video',
              title: 'The Hughes Six-Axis Model',
              type: 'video',
              filePath: `${BASE}/04-The 6MX Behavior Course Day Three/06-16- The Hughes Six-Axis Model.mp4`,
              fileName: '06-16- The Hughes Six-Axis Model.mp4',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Module 5 — Day Four
    // ──────────────────────────────────────────────
    {
      id: '6mx-day4',
      title: 'The 6MX Behavior Course Day Four',
      description:
        'Human needs mapping, neuropeptide influence on behavior, listening techniques, sensory preference analysis, the Six Pillars framework, and the Hughes Quadrant.',
      order: 5,
      lessons: [
        {
          id: '6mx-day4-human-needs-map',
          title: 'The Human Needs Map',
          description:
            'Framework for identifying and mapping fundamental human needs that drive behavior and decision-making.',
          order: 1,
          duration: '1h',
          keyTopics: ['human-needs', 'needs-mapping', 'behavioral-drivers', 'motivation'],
          resources: [
            {
              id: '6mx-day4-human-needs-map-video',
              title: 'The Human Needs Map',
              type: 'video',
              filePath: `${BASE}/05-The 6MX Behavior Course Day Four/01-17- The Human Needs Map.mp4`,
              fileName: '01-17- The Human Needs Map.mp4',
            },
          ],
        },
        {
          id: '6mx-day4-identifying-needs',
          title: 'Visually Identifying Needs and Exposing Hidden Fears',
          description:
            "Techniques for visually identifying a person's dominant needs and uncovering hidden fears through behavioral observation.",
          order: 2,
          duration: '1h',
          keyTopics: [
            'visual-identification',
            'hidden-fears',
            'needs-assessment',
            'behavioral-observation',
          ],
          resources: [
            {
              id: '6mx-day4-identifying-needs-video',
              title: 'Visually Identifying Needs and Exposing Hidden Fears',
              type: 'video',
              filePath: `${BASE}/05-The 6MX Behavior Course Day Four/02-18- Visually Identifying Needs and Exposing Hidden Fears.mp4`,
              fileName: '02-18- Visually Identifying Needs and Exposing Hidden Fears.mp4',
            },
          ],
        },
        {
          id: '6mx-day4-neuropeptides',
          title: 'Needs and Neuropeptides',
          description:
            'How neuropeptides influence behavior, emotional states, and decision-making in relation to human needs.',
          order: 3,
          duration: '1h',
          keyTopics: [
            'neuropeptides',
            'neurochemistry',
            'emotional-influence',
            'behavioral-chemistry',
          ],
          resources: [
            {
              id: '6mx-day4-neuropeptides-video',
              title: 'Needs and Neuropeptides',
              type: 'video',
              filePath: `${BASE}/05-The 6MX Behavior Course Day Four/03-19- Needs and Neuropeptides.mp4`,
              fileName: '03-19- Needs and Neuropeptides.mp4',
            },
          ],
        },
        {
          id: '6mx-day4-listening',
          title: 'Listening Between the Lines',
          description:
            'Advanced listening techniques for detecting hidden meaning, emotional undertones, and unspoken information.',
          order: 4,
          duration: '1h',
          keyTopics: [
            'active-listening',
            'subtext-analysis',
            'verbal-indicators',
            'hidden-meaning',
          ],
          resources: [
            {
              id: '6mx-day4-listening-video',
              title: 'Listening Between the Lines',
              type: 'video',
              filePath: `${BASE}/05-The 6MX Behavior Course Day Four/04-20- Listening Between the Lines.mp4`,
              fileName: '04-20- Listening Between the Lines.mp4',
            },
          ],
        },
        {
          id: '6mx-day4-sensory-preference',
          title: 'Sensory Preference and Adjective Choices',
          description:
            'Identifying sensory preferences (visual, auditory, kinesthetic) through language patterns and adjective selection.',
          order: 5,
          duration: '1h',
          keyTopics: ['sensory-preference', 'language-patterns', 'vak-model', 'adjective-analysis'],
          resources: [
            {
              id: '6mx-day4-sensory-preference-video',
              title: 'Sensory Preference and Adjective Choices',
              type: 'video',
              filePath: `${BASE}/05-The 6MX Behavior Course Day Four/05-21- Sensory Preference and Adjective Choices.mp4`,
              fileName: '05-21- Sensory Preference and Adjective Choices.mp4',
            },
          ],
        },
        {
          id: '6mx-day4-six-pillars',
          title: 'The Six Pillars',
          description:
            'The Six Pillars framework for structuring behavioral assessment and building comprehensive behavioral profiles.',
          order: 6,
          duration: '1h',
          keyTopics: [
            'six-pillars',
            'behavioral-assessment',
            'profile-building',
            'structured-analysis',
          ],
          resources: [
            {
              id: '6mx-day4-six-pillars-video',
              title: 'The Six Pillars',
              type: 'video',
              filePath: `${BASE}/05-The 6MX Behavior Course Day Four/06-22- The Six Pillars.mp4`,
              fileName: '06-22- The Six Pillars.mp4',
            },
          ],
        },
        {
          id: '6mx-day4-hughes-quadrant',
          title: 'The Hughes Quadrant',
          description:
            'The Hughes Quadrant model for categorizing behavioral tendencies across two intersecting axes of personality.',
          order: 7,
          duration: '1h',
          keyTopics: [
            'hughes-quadrant',
            'personality-categorization',
            'behavioral-tendencies',
            'quadrant-model',
          ],
          resources: [
            {
              id: '6mx-day4-hughes-quadrant-video',
              title: 'The Hughes Quadrant',
              type: 'video',
              filePath: `${BASE}/05-The 6MX Behavior Course Day Four/07-23- The Hughes Quadrant.mp4`,
              fileName: '07-23- The Hughes Quadrant.mp4',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Module 6 — Day Five
    // ──────────────────────────────────────────────
    {
      id: '6mx-day5',
      title: 'The 6MX Behavior Course Day Five',
      description:
        'The Behavior Compass, de-escalation mastery, the ND influence technique, and consistency hacking for behavioral influence.',
      order: 6,
      lessons: [
        {
          id: '6mx-day5-behavior-compass',
          title: 'The Behavior Compass',
          description:
            'Introduction to the Behavior Compass tool for navigating behavioral interactions and predicting responses.',
          order: 1,
          duration: '1h',
          keyTopics: ['behavior-compass', 'interaction-navigation', 'response-prediction'],
          resources: [
            {
              id: '6mx-day5-behavior-compass-video',
              title: 'The Behavior Compass',
              type: 'video',
              filePath: `${BASE}/06-The 6MX Behavior Course Day Five/01-24- The Behavior Compass.mp4`,
              fileName: '01-24- The Behavior Compass.mp4',
            },
          ],
        },
        {
          id: '6mx-day5-de-escalation',
          title: '6MX and De-Escalation Mastery',
          description:
            'Applying 6MX behavioral principles to de-escalation scenarios for conflict resolution and crisis management.',
          order: 2,
          duration: '1h',
          keyTopics: [
            'de-escalation',
            'conflict-resolution',
            'crisis-management',
            'behavioral-de-escalation',
          ],
          resources: [
            {
              id: '6mx-day5-de-escalation-video',
              title: '6MX and De-Escalation Mastery',
              type: 'video',
              filePath: `${BASE}/06-The 6MX Behavior Course Day Five/02-25- 6MX and De-Escalation Mastery.mp4`,
              fileName: '02-25- 6MX and De-Escalation Mastery.mp4',
            },
          ],
        },
        {
          id: '6mx-day5-nd-technique',
          title: 'ND - The Number One Influence Technique',
          description:
            'The ND technique -- the most powerful single influence technique for creating compliance and behavioral change.',
          order: 3,
          duration: '1h',
          keyTopics: ['nd-technique', 'influence', 'compliance', 'behavioral-change'],
          resources: [
            {
              id: '6mx-day5-nd-technique-video',
              title: 'ND - The Number One Influence Technique',
              type: 'video',
              filePath: `${BASE}/06-The 6MX Behavior Course Day Five/03-26- ND - The Number One Influence Technique.mp4`,
              fileName: '03-26- ND - The Number One Influence Technique.mp4',
            },
          ],
        },
        {
          id: '6mx-day5-consistency-hacking',
          title: 'The Consistency Hacking Question',
          description:
            'Using consistency hacking to leverage psychological commitment patterns for influence and persuasion.',
          order: 4,
          duration: '1h',
          keyTopics: [
            'consistency-hacking',
            'commitment-patterns',
            'persuasion',
            'psychological-leverage',
          ],
          resources: [
            {
              id: '6mx-day5-consistency-hacking-video',
              title: 'The Consistency Hacking Question',
              type: 'video',
              filePath: `${BASE}/06-The 6MX Behavior Course Day Five/04-27- The Consistency Hacking Question.mp4`,
              fileName: '04-27- The Consistency Hacking Question.mp4',
            },
            {
              id: '6mx-day5-surgical-comm-handbook',
              title: 'Surgical Communication Handbook',
              type: 'pdf',
              filePath: `${BASE}/06-The 6MX Behavior Course Day Five/04-Surgical_Communication_Handbook.pdf`,
              fileName: '04-Surgical_Communication_Handbook.pdf',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Module 7 — Resources
    // ──────────────────────────────────────────────
    {
      id: '6mx-resources',
      title: 'The 6MX Behavior Course Resources',
      description:
        'Supplementary reference materials including course cards, the 6MX Behavior Compass breakdown, and the Behavioral Table of Elements.',
      order: 7,
      lessons: [
        {
          id: '6mx-resources-course-cards',
          title: 'Course Cards',
          description:
            'Printable course cards summarizing key concepts from each day of the 6MX behavior course.',
          order: 1,
          duration: '0.25h',
          keyTopics: ['course-cards', 'reference-material', 'study-aid', 'daily-summaries'],
          resources: [
            {
              id: '6mx-resources-course-cards-overview',
              title: 'The Course Cards',
              type: 'pdf',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/01-01 Course Cards/01-01 The Course Cards.pdf`,
              fileName: '01-01 The Course Cards.pdf',
            },
            {
              id: '6mx-resources-course-cards-day1',
              title: '6MX - Day 1 Card',
              type: 'pdf',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/01-01 Course Cards/01-6MX_-_Day_1.pdf`,
              fileName: '01-6MX_-_Day_1.pdf',
            },
            {
              id: '6mx-resources-course-cards-day2',
              title: '6MX - Day 2 Card',
              type: 'pdf',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/01-01 Course Cards/01-6MX_-_Day_2.pdf`,
              fileName: '01-6MX_-_Day_2.pdf',
            },
            {
              id: '6mx-resources-course-cards-day3',
              title: '6MX - Day 3 Card',
              type: 'pdf',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/01-01 Course Cards/01-6MX_-_Day_3.pdf`,
              fileName: '01-6MX_-_Day_3.pdf',
            },
            {
              id: '6mx-resources-course-cards-day4',
              title: '6MX - Day 4 Card',
              type: 'pdf',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/01-01 Course Cards/01-6MX_-_Day_4.pdf`,
              fileName: '01-6MX_-_Day_4.pdf',
            },
            {
              id: '6mx-resources-course-cards-day5',
              title: '6MX - Day 5 Card',
              type: 'pdf',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/01-01 Course Cards/01-6MX_-_Day_5.pdf`,
              fileName: '01-6MX_-_Day_5.pdf',
            },
          ],
        },
        {
          id: '6mx-resources-compass',
          title: '6MX Behavior Compass',
          description:
            'Detailed breakdown of the 6MX Behavior Compass tool with visual reference diagram.',
          order: 2,
          duration: '0.25h',
          keyTopics: ['behavior-compass', 'compass-breakdown', 'visual-reference'],
          resources: [
            {
              id: '6mx-resources-compass-breakdown-overview',
              title: '6MX Compass Breakdown',
              type: 'pdf',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/02-02 6MX Compass/01-01 6MX Compass Breakdown.pdf`,
              fileName: '01-01 6MX Compass Breakdown.pdf',
            },
            {
              id: '6mx-resources-compass-breakdown-detail',
              title: '6MX Behavior Compass Breakdown',
              type: 'pdf',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/02-02 6MX Compass/01-6MX_Behavior_Compass_Breakdown.pdf`,
              fileName: '01-6MX_Behavior_Compass_Breakdown.pdf',
            },
            {
              id: '6mx-resources-compass-image',
              title: '6MX Compass Diagram',
              type: 'image',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/02-02 6MX Compass/02-6MX_Compass.png`,
              fileName: '02-6MX_Compass.png',
            },
          ],
        },
        {
          id: '6mx-resources-bte',
          title: 'The Behavioral Table of Elements (BTE)',
          description:
            'Reference copy of the Behavioral Table of Elements for use alongside the course material.',
          order: 3,
          duration: '0.25h',
          keyTopics: ['behavioral-table-of-elements', 'reference-chart', 'behavior-classification'],
          resources: [
            {
              id: '6mx-resources-bte-pdf',
              title: '2024 Mom Edition BTE Final',
              type: 'pdf',
              filePath: `${BASE}/07-The 6MX Behavior Course Resources/03-03 The Behavioral Table of Elements BTE/01-2024_Mom_Edition_BTE_Final.pdf`,
              fileName: '01-2024_Mom_Edition_BTE_Final.pdf',
            },
          ],
        },
      ],
    },
  ],
}
