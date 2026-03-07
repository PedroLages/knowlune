import type { Course } from '@/data/types'

const BASE = '/Volumes/SSD/GFX/Chase Hughes - The Operative Kit/05-Operative Six'

export const operativeSix: Course = {
  id: 'operative-six',
  title: 'Operative Six',
  shortTitle: 'Operative Six',
  description:
    'A comprehensive operative training course covering the pillars of influence, the Milgram experiment, the Six-Axis Model, confidence building, reading people, deception detection, elicitation, influence and authority, persuasive language, tradecraft, and the Behavior Compass Interview.',
  category: 'operative-training',
  difficulty: 'intermediate',
  totalLessons: 13,
  totalVideos: 12,
  totalPDFs: 7,
  estimatedHours: 14,
  isSequential: true,
  basePath: BASE,
  coverImage: '/images/operative-six',
  instructorId: 'chase-hughes',
  tags: [
    'operative-training',
    'influence',
    'authority',
    'deception-detection',
    'elicitation',
    'tradecraft',
    'six-axis-model',
    'behavior-compass',
    'reading-people',
    'confidence',
  ],
  modules: [
    {
      id: 'op6-course',
      title: 'The Course',
      description:
        'Complete Operative Six training program covering influence, behavioral analysis, deception detection, elicitation, authority, tradecraft, and the Behavior Compass Interview.',
      order: 1,
      lessons: [
        // ── Lesson 1: Introduction ──
        {
          id: 'op6-introduction',
          title: 'Introduction',
          description:
            'Course orientation and overview of the Operative Six training program, its goals, and the skills you will develop.',
          order: 1,
          duration: '2m',
          keyTopics: ['course-overview', 'operative-training', 'learning-objectives'],
          resources: [
            {
              id: 'op6-introduction-video',
              title: 'Introduction',
              type: 'video',
              filePath: `${BASE}/01-The Course/01-00- Introduction.mp4`,
              fileName: '01-00- Introduction.mp4',
              metadata: {
                duration: 144,
                chapters: [
                  { time: 30, title: 'Course Overview' },
                  { time: 120, title: 'Training Objectives' },
                  { time: 240, title: 'Program Structure' },
                ],
                captions: [
                  {
                    src: '/captions/op6-introduction.vtt',
                    label: 'English',
                    language: 'en',
                    default: true,
                  },
                ],
              },
            },
            {
              id: 'op6-introduction-pdf',
              title: 'Introduction Handout',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/01-00- Introduction.pdf`,
              fileName: '01-00- Introduction.pdf',
            },
          ],
        },

        // ── Lesson 2: Pillars of Influence ──
        {
          id: 'op6-pillars-of-influence',
          title: 'The Pillars of Influence',
          description:
            'The foundational pillars that underpin all effective influence, including psychological principles and behavioral leverage points.',
          order: 2,
          duration: '16m',
          keyTopics: ['pillars-of-influence', 'psychological-principles', 'behavioral-leverage'],
          resources: [
            {
              id: 'op6-pillars-of-influence-video',
              title: 'The Pillars of Influence',
              type: 'video',
              filePath: `${BASE}/01-The Course/02-01- The Pillars of Influence.mp4`,
              fileName: '02-01- The Pillars of Influence.mp4',
              metadata: { duration: 964 },
            },
          ],
        },

        // ── Lesson 3: Milgram Experiment ──
        {
          id: 'op6-milgram-experiment',
          title: 'The Milgram Experiment',
          description:
            'Analysis of the Milgram experiment and its implications for understanding obedience, authority, and compliance in real-world scenarios.',
          order: 3,
          duration: '15m',
          keyTopics: ['milgram-experiment', 'obedience', 'authority', 'compliance'],
          resources: [
            {
              id: 'op6-milgram-experiment-video',
              title: 'The Milgram Experiment',
              type: 'video',
              filePath: `${BASE}/01-The Course/03-02- The Milgram Experiment.mp4`,
              fileName: '03-02- The Milgram Experiment.mp4',
              metadata: { duration: 903 },
            },
          ],
        },

        // ── Lesson 4: Six-Axis Model ──
        {
          id: 'op6-six-axis-model',
          title: 'The Six-Axis Model',
          description:
            'The Hughes Six-Axis Model for profiling individuals across six behavioral dimensions to predict actions and tailor influence strategies.',
          order: 4,
          duration: '12m',
          keyTopics: [
            'six-axis-model',
            'behavioral-profiling',
            'personality-dimensions',
            'prediction',
          ],
          resources: [
            {
              id: 'op6-six-axis-model-video',
              title: 'The Six-Axis Model',
              type: 'video',
              filePath: `${BASE}/01-The Course/04-03- The Six-Axis Model.mp4`,
              fileName: '04-03- The Six-Axis Model.mp4',
              metadata: { duration: 714 },
            },
          ],
        },

        // ── Lesson 5: Confidence ──
        {
          id: 'op6-confidence',
          title: 'Confidence',
          description:
            'Building and projecting genuine confidence as a core operative skill, including body language, voice tonality, and mental frameworks.',
          order: 5,
          duration: '15m',
          keyTopics: [
            'confidence',
            'presence',
            'body-language',
            'voice-tonality',
            'mental-frameworks',
          ],
          resources: [
            {
              id: 'op6-confidence-video',
              title: 'Confidence',
              type: 'video',
              filePath: `${BASE}/01-The Course/05-04- Confidence.mp4`,
              fileName: '05-04- Confidence.mp4',
              metadata: { duration: 882 },
            },
          ],
        },

        // ── Lesson 6: Reading People ──
        {
          id: 'op6-reading-people',
          title: 'Reading People',
          description:
            'Techniques for rapidly assessing and reading people through behavioral cues, body language, and verbal patterns.',
          order: 6,
          duration: '24m',
          keyTopics: ['reading-people', 'behavioral-cues', 'rapid-assessment', 'body-language'],
          resources: [
            {
              id: 'op6-reading-people-video',
              title: 'Reading People',
              type: 'video',
              filePath: `${BASE}/01-The Course/06-05- Reading People.mp4`,
              fileName: '06-05- Reading People.mp4',
              metadata: { duration: 1451 },
            },
            {
              id: 'op6-reading-people-pdf',
              title: 'Reading People Handout',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/06-05- Reading People.pdf`,
              fileName: '06-05- Reading People.pdf',
            },
          ],
        },

        // ── Lesson 7: Deception Detection ──
        {
          id: 'op6-deception-detection',
          title: 'Deception Detection',
          description:
            'Identifying deceptive behavior through verbal and nonverbal indicators, baseline deviations, and cluster analysis.',
          order: 7,
          duration: '15m',
          keyTopics: [
            'deception-detection',
            'verbal-indicators',
            'nonverbal-indicators',
            'baseline-analysis',
          ],
          resources: [
            {
              id: 'op6-deception-detection-video',
              title: 'Deception Detection',
              type: 'video',
              filePath: `${BASE}/01-The Course/07-06- Deception Detection.mp4`,
              fileName: '07-06- Deception Detection.mp4',
              metadata: { duration: 889 },
            },
          ],
        },

        // ── Lesson 8: Elicitation ──
        {
          id: 'op6-elicitation',
          title: 'Elicitation',
          description:
            'Conversational elicitation techniques for extracting information without direct questioning, using natural dialogue patterns.',
          order: 8,
          duration: '11m',
          keyTopics: [
            'elicitation',
            'information-extraction',
            'conversational-techniques',
            'indirect-questioning',
          ],
          resources: [
            {
              id: 'op6-elicitation-video',
              title: 'Elicitation',
              type: 'video',
              filePath: `${BASE}/01-The Course/08-07- Elicitation.mp4`,
              fileName: '08-07- Elicitation.mp4',
              metadata: { duration: 675 },
            },
          ],
        },

        // ── Lesson 9: Influence and Authority ──
        {
          id: 'op6-influence-authority',
          title: 'Influence and Authority',
          description:
            'Leveraging influence and authority dynamics for persuasion, including social proof, reciprocity, and authority positioning.',
          order: 9,
          duration: '12m',
          keyTopics: ['influence', 'authority', 'social-proof', 'reciprocity', 'persuasion'],
          resources: [
            {
              id: 'op6-influence-authority-video',
              title: 'Influence and Authority',
              type: 'video',
              filePath: `${BASE}/01-The Course/09-08- Influence and Authority.mp4`,
              fileName: '09-08- Influence and Authority.mp4',
              metadata: { duration: 700 },
            },
          ],
        },

        // ── Lesson 10: Words to Influence Anyone ──
        {
          id: 'op6-words-to-influence',
          title: 'Words to Influence Anyone',
          description:
            'Specific language patterns, word choices, and verbal frameworks designed to maximize persuasive impact in any conversation.',
          order: 10,
          duration: '16m',
          keyTopics: [
            'persuasive-language',
            'word-choice',
            'verbal-frameworks',
            'language-patterns',
          ],
          resources: [
            {
              id: 'op6-words-to-influence-video',
              title: 'Words to Influence Anyone',
              type: 'video',
              filePath: `${BASE}/01-The Course/10-09- Words to Influence Anyone.mp4`,
              fileName: '10-09- Words to Influence Anyone.mp4',
              metadata: { duration: 969 },
            },
          ],
        },

        // ── Lesson 11: Art of Tradecraft ──
        {
          id: 'op6-art-of-tradecraft',
          title: 'The Art of Tradecraft',
          description:
            'Operative tradecraft principles including situational awareness, operational security, and practical field techniques.',
          order: 11,
          duration: '12m',
          keyTopics: [
            'tradecraft',
            'situational-awareness',
            'operational-security',
            'field-techniques',
          ],
          resources: [
            {
              id: 'op6-art-of-tradecraft-video',
              title: 'The Art of Tradecraft',
              type: 'video',
              filePath: `${BASE}/01-The Course/11-10- The Art of Tradecraft.mp4`,
              fileName: '11-10- The Art of Tradecraft.mp4',
              metadata: { duration: 734 },
            },
          ],
        },

        // ── Lesson 12: Behavior Compass Interview ──
        {
          id: 'op6-behavior-compass-interview',
          title: 'Behavior Compass Interview',
          description:
            'Applying the Behavior Compass framework in interview settings to read, assess, and influence subjects effectively.',
          order: 12,
          duration: '7m',
          keyTopics: [
            'behavior-compass',
            'interview-techniques',
            'subject-assessment',
            'applied-analysis',
          ],
          resources: [
            {
              id: 'op6-behavior-compass-interview-video',
              title: 'Behavior Compass Interview',
              type: 'video',
              filePath: `${BASE}/01-The Course/12-11- Behavior Compass Interview.mp4`,
              fileName: '12-11- Behavior Compass Interview.mp4',
              metadata: { duration: 415 },
            },
          ],
        },

        // ── Lesson 13: Resources ──
        {
          id: 'op6-resources',
          title: 'Resources',
          description:
            'Supplementary reference materials including the Operative Six handbook, Behavior Compass breakdown, compass reference, and the Hughes Authority Behavior Inventory.',
          order: 13,
          keyTopics: [
            'reference-materials',
            'behavior-compass',
            'authority-inventory',
            'operative-handbook',
          ],
          resources: [
            {
              id: 'op6-resources-overview',
              title: 'Resources Overview',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/13-12- Resources.pdf`,
              fileName: '13-12- Resources.pdf',
            },
            {
              id: 'op6-resources-operative-six-handbook',
              title: 'Operative Six Handbook',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/13-Operative_Six.pdf`,
              fileName: '13-Operative_Six.pdf',
            },
            {
              id: 'op6-resources-compass-breakdown',
              title: '6MX Behavior Compass Breakdown',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/13-6MX_Behavior_Compass_Breakdown.pdf`,
              fileName: '13-6MX_Behavior_Compass_Breakdown.pdf',
            },
            {
              id: 'op6-resources-compass-ref',
              title: '6MX Compass Reference',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/13-6MX_Compass.pdf`,
              fileName: '13-6MX_Compass.pdf',
            },
            {
              id: 'op6-resources-authority-inventory',
              title: 'The Hughes Authority Behavior Inventory (2024 NCI Edition)',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/13-The_Hughes_Authority_Behavior_Inventory_2024_NCI_Edition_.pdf`,
              fileName: '13-The_Hughes_Authority_Behavior_Inventory_2024_NCI_Edition_.pdf',
            },
          ],
        },
      ],
    },
  ],
}
