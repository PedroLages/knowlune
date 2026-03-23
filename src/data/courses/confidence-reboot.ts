import type { Course } from '@/data/types'

const BASE = '/Volumes/SSD/GFX/Chase Hughes - The Operative Kit/03-Confidence Reboot'

export const confidenceReboot: Course = {
  id: 'confidence-reboot',
  title: 'Confidence Reboot',
  shortTitle: 'Confidence Reboot',
  description:
    'A seven-phase sequential program designed to systematically rebuild confidence from the ground up. Progresses from mission briefing through installation, core training, programming with video entrainment, mentor visualization sessions, and graduation, with supporting audio programs and assessment tools.',
  category: 'confidence-mastery',
  difficulty: 'beginner',
  totalLessons: 18,
  totalVideos: 12,
  totalPDFs: 25,
  estimatedHours: 20,
  isSequential: true,
  basePath: BASE,
  coverImage: '/images/confidence-reboot',
  authorId: 'chase-hughes',
  tags: [
    'confidence',
    'composure',
    'limiting beliefs',
    'hypnosis',
    'entrainment',
    'mentors',
    'self-mastery',
  ],
  modules: [
    // ───────────────────────────────────────────────
    // PHASE 1 – Mission Briefing
    // ───────────────────────────────────────────────
    {
      id: 'cr-mission-briefing',
      title: 'Mission Briefing',
      description:
        'Orientation phase covering the reboot schedule, workspace setup, limiting beliefs, confidence masterclass, and composure fundamentals.',
      order: 1,
      lessons: [
        {
          id: 'cr-00-welcome',
          title: 'Welcome to the Reboot',
          description:
            'Introduction to the Confidence Reboot program, including the full schedule and what to expect.',
          order: 1,
          resources: [
            {
              id: 'cr-00-welcome-video',
              title: '00 - Welcome to the Reboot',
              type: 'video',
              filePath: `${BASE}/01-Mission Briefing/01-00- Welcome to the Reboot.mp4`,
              fileName: '01-00- Welcome to the Reboot.mp4',
            },
            {
              id: 'cr-00-welcome-pdf',
              title: '00 - Welcome to the Reboot',
              type: 'pdf',
              filePath: `${BASE}/01-Mission Briefing/01-00- Welcome to the Reboot.pdf`,
              fileName: '01-00- Welcome to the Reboot.pdf',
            },
            {
              id: 'cr-00-schedule',
              title: 'Confidence Reboot Schedule',
              type: 'pdf',
              filePath: `${BASE}/01-Mission Briefing/01-Confidence_Reboot_Schedulepdf.pdf`,
              fileName: '01-Confidence_Reboot_Schedulepdf.pdf',
            },
          ],
          keyTopics: ['program overview', 'schedule', 'expectations', 'getting started'],
          duration: '1h',
        },
        {
          id: 'cr-01-workspace',
          title: 'Building Your Workspace',
          description:
            'Setting up your physical and mental workspace with the control center audio guide and layout reference.',
          order: 2,
          resources: [
            {
              id: 'cr-01-workspace-pdf',
              title: '01 - Building Your Workspace',
              type: 'pdf',
              filePath: `${BASE}/01-Mission Briefing/02-01- Building Your Workspace.pdf`,
              fileName: '02-01- Building Your Workspace.pdf',
            },
            {
              id: 'cr-01-workspace-layout',
              title: 'Workspace Layout',
              type: 'image',
              filePath: `${BASE}/01-Mission Briefing/02-Workspace_Layout.jpeg`,
              fileName: '02-Workspace_Layout.jpeg',
            },
            {
              id: 'cr-01-workspace-audio',
              title: 'Workspace Setup - Control Center Audio',
              type: 'audio',
              filePath: `${BASE}/01-Mission Briefing/02-WORKSPACE_SETUP_-_CONTROL_CENTER.mp3`,
              fileName: '02-WORKSPACE_SETUP_-_CONTROL_CENTER.mp3',
            },
          ],
          keyTopics: ['workspace setup', 'control center', 'environment design'],
          duration: '0.5h',
        },
        {
          id: 'cr-02-limiting-beliefs',
          title: 'Limiting Beliefs',
          description:
            'Understanding and identifying the limiting beliefs that undermine confidence, with a companion worksheet.',
          order: 3,
          resources: [
            {
              id: 'cr-02-limiting-beliefs-video',
              title: '02 - Limiting Beliefs',
              type: 'video',
              filePath: `${BASE}/01-Mission Briefing/03-02- Limiting Beliefs.mp4`,
              fileName: '03-02- Limiting Beliefs.mp4',
            },
            {
              id: 'cr-02-limiting-beliefs-pdf',
              title: '02 - Limiting Beliefs',
              type: 'pdf',
              filePath: `${BASE}/01-Mission Briefing/03-02- Limiting Beliefs.pdf`,
              fileName: '03-02- Limiting Beliefs.pdf',
            },
            {
              id: 'cr-02-limiting-beliefs-worksheet',
              title: 'Limiting Beliefs Worksheet',
              type: 'pdf',
              filePath: `${BASE}/01-Mission Briefing/03-Limiting_Beliefs.pdf`,
              fileName: '03-Limiting_Beliefs.pdf',
            },
          ],
          keyTopics: ['limiting beliefs', 'self-assessment', 'mental blocks'],
          duration: '1h',
        },
        {
          id: 'cr-03-confidence-masterclass',
          title: 'Confidence Masterclass with Marczell Klein',
          description: 'Guest masterclass on confidence building techniques with Marczell Klein.',
          order: 4,
          resources: [
            {
              id: 'cr-03-masterclass-video',
              title: '03 - Confidence Masterclass with Marczell Klein',
              type: 'video',
              filePath: `${BASE}/01-Mission Briefing/04-03- Confidence Masterclass with Marczell Klein.mp4`,
              fileName: '04-03- Confidence Masterclass with Marczell Klein.mp4',
            },
            {
              id: 'cr-03-masterclass-pdf',
              title: '03 - Confidence Masterclass with Marczell Klein',
              type: 'pdf',
              filePath: `${BASE}/01-Mission Briefing/04-03- Confidence Masterclass with Marczell Klein.pdf`,
              fileName: '04-03- Confidence Masterclass with Marczell Klein.pdf',
            },
          ],
          keyTopics: ['confidence techniques', 'masterclass', 'guest instructor'],
          duration: '1h',
        },
        {
          id: 'cr-04-composure',
          title: 'What is Composure',
          description:
            'Defining and understanding composure as a foundational element of confidence.',
          order: 5,
          resources: [
            {
              id: 'cr-04-composure-video',
              title: '04 - What is Composure',
              type: 'video',
              filePath: `${BASE}/01-Mission Briefing/05-04- What is Composure.mp4`,
              fileName: '05-04- What is Composure.mp4',
            },
          ],
          keyTopics: ['composure', 'emotional regulation', 'presence'],
          duration: '1h',
        },
      ],
    },

    // ───────────────────────────────────────────────
    // PHASE 2 – Installation
    // ───────────────────────────────────────────────
    {
      id: 'cr-installation',
      title: 'Installation',
      description:
        'Nightly audio installation phase designed to reprogram subconscious confidence patterns.',
      order: 2,
      lessons: [
        {
          id: 'cr-05-nightly-audio',
          title: 'Nightly Audio',
          description:
            'Guided nightly audio program for subconscious confidence installation during sleep.',
          order: 1,
          resources: [
            {
              id: 'cr-05-nightly-audio-pdf',
              title: '05 - Nightly Audio Instructions',
              type: 'pdf',
              filePath: `${BASE}/02-Installation/01-05- Nightly Audio.pdf`,
              fileName: '01-05- Nightly Audio.pdf',
            },
            {
              id: 'cr-05-nightly-audio-mp3',
              title: 'Confidence Reboot Nightly Audio',
              type: 'audio',
              filePath: `${BASE}/02-Installation/01-CONFIDENCE_REBOOT_NIGHTLY_AUDIO.mp3`,
              fileName: '01-CONFIDENCE_REBOOT_NIGHTLY_AUDIO.mp3',
            },
          ],
          keyTopics: ['nightly audio', 'subconscious programming', 'sleep learning'],
          duration: '0.5h',
        },
      ],
    },

    // ───────────────────────────────────────────────
    // PHASE 3 – Core Training
    // ───────────────────────────────────────────────
    {
      id: 'cr-core-training',
      title: 'Core Training',
      description:
        'Core skill-building phase covering behavior inventory assessment, tracking, limiting beliefs, alpha leadership, and comfort-vs-anxiety dynamics.',
      order: 3,
      lessons: [
        {
          id: 'cr-06-behavior-inventory',
          title: 'Behavior Inventory Assessment',
          description:
            'Self-assessment of current behavioral patterns using the Confidence Assessment tool.',
          order: 1,
          resources: [
            {
              id: 'cr-06-behavior-inventory-pdf',
              title: '06 - Behavior Inventory Assessment',
              type: 'pdf',
              filePath: `${BASE}/03-Core Training/01-06- Behavior Inventory Assessment.pdf`,
              fileName: '01-06- Behavior Inventory Assessment.pdf',
            },
          ],
          keyTopics: ['behavior inventory', 'self-assessment', 'baseline measurement'],
          duration: '0.5h',
        },
        {
          id: 'cr-07-tracker',
          title: 'The Tracker',
          description:
            'Introduction to the Confidence Reboot Tracker for monitoring daily progress and behavioral changes.',
          order: 2,
          resources: [
            {
              id: 'cr-07-tracker-pdf',
              title: '07 - The Tracker',
              type: 'pdf',
              filePath: `${BASE}/03-Core Training/02-07- The Tracker.pdf`,
              fileName: '02-07- The Tracker.pdf',
            },
            {
              id: 'cr-07-tracker-form',
              title: 'Confidence Reboot Tracker',
              type: 'pdf',
              filePath: `${BASE}/03-Core Training/02-Confidence_Reboot_Trackerpdf.pdf`,
              fileName: '02-Confidence_Reboot_Trackerpdf.pdf',
            },
          ],
          keyTopics: ['progress tracking', 'daily habits', 'behavioral monitoring'],
          duration: '0.25h',
        },
        {
          id: 'cr-08-limiting-beliefs-deep',
          title: 'Limiting Beliefs (Deep Dive)',
          description:
            'Advanced session on dismantling limiting beliefs with the accompanying worksheet.',
          order: 3,
          resources: [
            {
              id: 'cr-08-limiting-beliefs-video',
              title: '08 - Limiting Beliefs',
              type: 'video',
              filePath: `${BASE}/03-Core Training/03-08- Limiting Beliefs.mp4`,
              fileName: '03-08- Limiting Beliefs.mp4',
            },
            {
              id: 'cr-08-limiting-beliefs-pdf',
              title: '08 - Limiting Beliefs',
              type: 'pdf',
              filePath: `${BASE}/03-Core Training/03-08- Limiting Beliefs.pdf`,
              fileName: '03-08- Limiting Beliefs.pdf',
            },
            {
              id: 'cr-08-limiting-beliefs-worksheet',
              title: 'Limiting Beliefs Worksheet',
              type: 'pdf',
              filePath: `${BASE}/03-Core Training/03-Limiting_Beliefs.pdf`,
              fileName: '03-Limiting_Beliefs.pdf',
            },
          ],
          keyTopics: ['limiting beliefs', 'belief dismantling', 'cognitive reframing'],
          duration: '1h',
        },
        {
          id: 'cr-09-alpha-leader',
          title: 'The Alpha Leader',
          description:
            'Exploring the behavioral traits and mindset of alpha leadership and confident presence.',
          order: 4,
          resources: [
            {
              id: 'cr-09-alpha-leader-video',
              title: '09 - The Alpha Leader',
              type: 'video',
              filePath: `${BASE}/03-Core Training/04-09- The Alpha Leader.mp4`,
              fileName: '04-09- The Alpha Leader.mp4',
            },
            {
              id: 'cr-09-alpha-leader-pdf',
              title: '09 - The Alpha Leader',
              type: 'pdf',
              filePath: `${BASE}/03-Core Training/04-09- The Alpha Leader.pdf`,
              fileName: '04-09- The Alpha Leader.pdf',
            },
          ],
          keyTopics: ['alpha leadership', 'presence', 'behavioral traits', 'authority'],
          duration: '1h',
        },
        {
          id: 'cr-10-comfort-vs-anxiety',
          title: 'Comfort Vs Anxiety',
          description:
            'Understanding the tension between comfort and anxiety, with real-world examples of confident behavior under pressure.',
          order: 5,
          resources: [
            {
              id: 'cr-10-comfort-anxiety-video',
              title: '10 - Comfort Vs Anxiety',
              type: 'video',
              filePath: `${BASE}/03-Core Training/05-10- Comfort Vs Anxiety.mp4`,
              fileName: '05-10- Comfort Vs Anxiety.mp4',
            },
            {
              id: 'cr-10-comfort-anxiety-pdf',
              title: '10 - Comfort Vs Anxiety',
              type: 'pdf',
              filePath: `${BASE}/03-Core Training/05-10- Comfort Vs Anxiety.pdf`,
              fileName: '05-10- Comfort Vs Anxiety.pdf',
            },
            {
              id: 'cr-10-comedians-cars-video',
              title: "Comedians in Cars Getting Coffee: Just Tell Him You're The President",
              type: 'video',
              filePath: `${BASE}/03-Core Training/05-Comedians in Cars Getting Coffee_ _Just Tell Him Youre The President Season 7 Episode 1.mp4`,
              fileName:
                '05-Comedians in Cars Getting Coffee_ _Just Tell Him Youre The President Season 7 Episode 1.mp4',
            },
            {
              id: 'cr-10-bush-impressions-video',
              title: 'President George W Bush Reveals If Impressions Bothered Him',
              type: 'video',
              filePath: `${BASE}/03-Core Training/05-President George W Bush Reveals If Impressions Bothered Him.mp4`,
              fileName: '05-President George W Bush Reveals If Impressions Bothered Him.mp4',
            },
          ],
          keyTopics: [
            'comfort zones',
            'anxiety management',
            'confidence under pressure',
            'real-world examples',
          ],
          duration: '1.5h',
        },
      ],
    },

    // ───────────────────────────────────────────────
    // PHASE 4 – Programming
    // ───────────────────────────────────────────────
    {
      id: 'cr-programming',
      title: 'Programming',
      description:
        'Advanced confidence programming phase using imprinting switch installation and three levels of video entrainment.',
      order: 4,
      lessons: [
        {
          id: 'cr-11-phase-three-instructions',
          title: 'Reboot Phase Three Instructions',
          description: 'Instructions for entering the programming phase of the confidence reboot.',
          order: 1,
          resources: [
            {
              id: 'cr-11-instructions-pdf',
              title: '11 - Reboot Phase Three Instructions',
              type: 'pdf',
              filePath: `${BASE}/04-Programming/01-11- Reboot Phase Three Instructions.pdf`,
              fileName: '01-11- Reboot Phase Three Instructions.pdf',
            },
          ],
          keyTopics: ['phase instructions', 'programming preparation'],
          duration: '0.25h',
        },
        {
          id: 'cr-12-imprinting-switch',
          title: 'The Imprinting Switch Installation',
          description:
            'Guided audio session for installing the imprinting switch - a core confidence programming technique.',
          order: 2,
          resources: [
            {
              id: 'cr-12-imprinting-pdf',
              title: '12 - The Imprinting Switch Installation',
              type: 'pdf',
              filePath: `${BASE}/04-Programming/02-12- The Imprinting Switch Installation.pdf`,
              fileName: '02-12- The Imprinting Switch Installation.pdf',
            },
            {
              id: 'cr-12-imprinting-audio',
              title: 'Confidence Reboot Imprint Switch Audio',
              type: 'audio',
              filePath: `${BASE}/04-Programming/02-CONFIDENCE_REBOOT_IMPRINT_SWITCH.mp3`,
              fileName: '02-CONFIDENCE_REBOOT_IMPRINT_SWITCH.mp3',
            },
          ],
          keyTopics: ['imprinting', 'switch installation', 'subconscious programming'],
          duration: '0.5h',
        },
        {
          id: 'cr-13-entrainment-level-1',
          title: 'Video Entrainment Level One',
          description: 'First level of video entrainment for confidence pattern installation.',
          order: 3,
          resources: [
            {
              id: 'cr-13-entrainment-1-video',
              title: '13 - Video Entrainment Level One',
              type: 'video',
              filePath: `${BASE}/04-Programming/03-13- Video Entrainment Level One.mp4`,
              fileName: '03-13- Video Entrainment Level One.mp4',
            },
            {
              id: 'cr-13-entrainment-1-pdf',
              title: '13 - Video Entrainment Level One',
              type: 'pdf',
              filePath: `${BASE}/04-Programming/03-13- Video Entrainment Level One.pdf`,
              fileName: '03-13- Video Entrainment Level One.pdf',
            },
          ],
          keyTopics: ['video entrainment', 'level one', 'pattern installation'],
          duration: '1h',
        },
        {
          id: 'cr-14-entrainment-level-2',
          title: 'Video Entrainment Level Two',
          description: 'Second level of video entrainment with increased intensity.',
          order: 4,
          resources: [
            {
              id: 'cr-14-entrainment-2-video',
              title: '14 - Video Entrainment Level Two',
              type: 'video',
              filePath: `${BASE}/04-Programming/04-14- Video Entrainment Level Two.mp4`,
              fileName: '04-14- Video Entrainment Level Two.mp4',
            },
            {
              id: 'cr-14-entrainment-2-pdf',
              title: '14 - Video Entrainment Level Two',
              type: 'pdf',
              filePath: `${BASE}/04-Programming/04-14- Video Entrainment Level Two.pdf`,
              fileName: '04-14- Video Entrainment Level Two.pdf',
            },
          ],
          keyTopics: ['video entrainment', 'level two', 'deepening patterns'],
          duration: '1h',
        },
        {
          id: 'cr-15-entrainment-level-3',
          title: 'Video Entrainment Level Three',
          description:
            'Third and final level of video entrainment for full confidence integration.',
          order: 5,
          resources: [
            {
              id: 'cr-15-entrainment-3-video',
              title: '15 - Video Entrainment Level Three',
              type: 'video',
              filePath: `${BASE}/04-Programming/05-15- Video Entrainment Level Three.mp4`,
              fileName: '05-15- Video Entrainment Level Three.mp4',
            },
            {
              id: 'cr-15-entrainment-3-pdf',
              title: '15 - Video Entrainment Level Three',
              type: 'pdf',
              filePath: `${BASE}/04-Programming/05-15- Video Entrainment Level Three.pdf`,
              fileName: '05-15- Video Entrainment Level Three.pdf',
            },
          ],
          keyTopics: ['video entrainment', 'level three', 'full integration'],
          duration: '1h',
        },
      ],
    },

    // ───────────────────────────────────────────────
    // PHASE 5 – The Mentors
    // ───────────────────────────────────────────────
    {
      id: 'cr-the-mentors',
      title: 'The Mentors',
      description:
        'Visualization phase using guided audio to build an internal conference room of mentors for ongoing confidence guidance.',
      order: 5,
      lessons: [
        {
          id: 'cr-16-conference-room',
          title: 'Building the Conference Room',
          description:
            'Guided visualization and audio for constructing your internal mentor conference room.',
          order: 1,
          resources: [
            {
              id: 'cr-16-conference-room-pdf',
              title: '16 - Building the Conference Room',
              type: 'pdf',
              filePath: `${BASE}/05-The Mentors/01-16- Building the Conference Room.pdf`,
              fileName: '01-16- Building the Conference Room.pdf',
            },
            {
              id: 'cr-16-conference-room-audio',
              title: 'Confidence Program Conference Room Audio',
              type: 'audio',
              filePath: `${BASE}/05-The Mentors/01-CONFIDENCE_PROGRAM_CONFERENCE_ROOM.mp3`,
              fileName: '01-CONFIDENCE_PROGRAM_CONFERENCE_ROOM.mp3',
            },
            {
              id: 'cr-16-conference-room-guide',
              title: 'The Conference Room User Guide',
              type: 'pdf',
              filePath: `${BASE}/05-The Mentors/01-THE_CONFERENCE_ROOM_USER_GUIDEpdf.pdf`,
              fileName: '01-THE_CONFERENCE_ROOM_USER_GUIDEpdf.pdf',
            },
          ],
          keyTopics: [
            'visualization',
            'mentor conference room',
            'guided imagery',
            'internal mentors',
          ],
          duration: '1h',
        },
        {
          id: 'cr-17-first-meeting',
          title: 'Conference Room: Your First Meeting',
          description: 'Your first guided board meeting with your internal mentor council.',
          order: 2,
          resources: [
            {
              id: 'cr-17-first-meeting-pdf',
              title: '17 - Conference Room: Your First Meeting',
              type: 'pdf',
              filePath: `${BASE}/05-The Mentors/02-17- Conference Room- Your First Meeting.pdf`,
              fileName: '02-17- Conference Room- Your First Meeting.pdf',
            },
            {
              id: 'cr-17-first-meeting-audio',
              title: 'Confidence Program First Board Meeting Audio',
              type: 'audio',
              filePath: `${BASE}/05-The Mentors/02-CONFIDENCE_PROGRAM_FIRST_BOARD_MEETING.mp3`,
              fileName: '02-CONFIDENCE_PROGRAM_FIRST_BOARD_MEETING.mp3',
            },
          ],
          keyTopics: ['first meeting', 'board meeting', 'mentor guidance', 'visualization'],
          duration: '0.5h',
        },
      ],
    },

    // ───────────────────────────────────────────────
    // PHASE 6 – Graduation
    // ───────────────────────────────────────────────
    {
      id: 'cr-graduation',
      title: 'Graduation',
      description:
        'Graduation ceremony marking the completion of the Confidence Reboot program with a guided audio celebration.',
      order: 6,
      lessons: [
        {
          id: 'cr-18-graduation-ceremony',
          title: 'Graduation Ceremony',
          description:
            'Guided graduation ceremony audio marking your successful completion of the Confidence Reboot program.',
          order: 1,
          resources: [
            {
              id: 'cr-18-graduation-pdf',
              title: '18 - Graduation Ceremony',
              type: 'pdf',
              filePath: `${BASE}/06-Graduation/01-18- Graduation Ceremony.pdf`,
              fileName: '01-18- Graduation Ceremony.pdf',
            },
            {
              id: 'cr-18-graduation-audio',
              title: 'Confidence Reboot Graduation Audio',
              type: 'audio',
              filePath: `${BASE}/06-Graduation/01-CONFIDENCE_REBOOT_GRADUATION.mp3`,
              fileName: '01-CONFIDENCE_REBOOT_GRADUATION.mp3',
            },
          ],
          keyTopics: ['graduation', 'completion', 'celebration', 'next steps'],
          duration: '0.5h',
        },
      ],
    },

    // ───────────────────────────────────────────────
    // PHASE 7 – Resources
    // ───────────────────────────────────────────────
    {
      id: 'cr-resources',
      title: 'Resources',
      description:
        'Supplementary course resources including the Animal Behavior Chart and the complete Confidence Reboot reference guide.',
      order: 7,
      lessons: [
        {
          id: 'cr-course-resources',
          title: 'Course Resources',
          description:
            'Collection of reference materials and supplementary resources for ongoing use after completing the program.',
          order: 1,
          resources: [
            {
              id: 'cr-resources-pdf',
              title: '01 Course Resources',
              type: 'pdf',
              filePath: `${BASE}/07-Resources/01-01 Course Resources.pdf`,
              fileName: '01-01 Course Resources.pdf',
            },
            {
              id: 'cr-resources-animal-chart',
              title: 'Animal Behavior Chart 2023',
              type: 'image',
              filePath: `${BASE}/07-Resources/01-Animal_Behavior_Chart_2023.png`,
              fileName: '01-Animal_Behavior_Chart_2023.png',
            },
            {
              id: 'cr-resources-reboot-guide',
              title: 'Confidence Reboot Reference Guide',
              type: 'pdf',
              filePath: `${BASE}/07-Resources/01-Confidence_Reboot.pdf`,
              fileName: '01-Confidence_Reboot.pdf',
            },
          ],
          keyTopics: ['reference materials', 'animal behavior chart', 'course summary'],
          duration: '0.25h',
        },
      ],
    },
  ],
}
