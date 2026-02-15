import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { VideoPlayer } from './VideoPlayer'
import type { CaptionTrack } from '@/data/types'

/**
 * VideoPlayer component with full controls including:
 * - Play/Pause functionality
 * - Volume control with mute toggle
 * - Playback speed adjustment (0.5x to 2x)
 * - Fullscreen support
 * - Caption/subtitle support
 * - Progress bar with seek capability
 * - Keyboard shortcuts (Space/K: play/pause, Arrow keys: seek/volume, M: mute, F: fullscreen, C: captions)
 * - Auto-hide controls after 3 seconds of inactivity
 * - Persistent settings (playback speed and caption preference saved to localStorage)
 *
 * The component is fully accessible with ARIA labels and keyboard navigation.
 */
const meta = {
  title: 'Components/VideoPlayer',
  component: VideoPlayer,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'light',
    },
  },
  tags: ['autodocs'],
  decorators: [
    Story => (
      <div className="w-full max-w-4xl">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    src: {
      control: 'text',
      description: 'Video source URL',
    },
    title: {
      control: 'text',
      description: 'Video title for accessibility',
    },
    initialPosition: {
      control: { type: 'number', min: 0, max: 100 },
      description: 'Initial playback position in seconds',
    },
    seekToTime: {
      control: { type: 'number', min: 0, max: 100 },
      description: 'External seek request time in seconds',
    },
    captions: {
      description: 'Array of caption/subtitle tracks',
    },
    onTimeUpdate: {
      description: 'Callback fired on video time updates',
      action: 'timeUpdate',
    },
    onEnded: {
      description: 'Callback fired when video ends',
      action: 'videoEnded',
    },
    onSeekComplete: {
      description: 'Callback fired after external seek completes',
      action: 'seekComplete',
    },
  },
} satisfies Meta<typeof VideoPlayer>

export default meta
type Story = StoryObj<typeof meta>

// Sample video URLs (using Big Buck Bunny from Blender Foundation - public domain)
const sampleVideoUrl =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
const alternativeVideoUrl =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'

// Sample caption tracks
const sampleCaptions: CaptionTrack[] = [
  {
    src: '/captions/en.vtt',
    label: 'English',
    language: 'en',
    default: true,
  },
  {
    src: '/captions/es.vtt',
    label: 'Spanish',
    language: 'es',
  },
]

/**
 * Default video player with standard configuration
 */
export const Default: Story = {
  args: {
    src: sampleVideoUrl,
    title: 'Big Buck Bunny - Sample Video',
  },
}

/**
 * Video player with title displayed for accessibility
 */
export const WithTitle: Story = {
  args: {
    src: sampleVideoUrl,
    title: 'Introduction to Behavioral Analysis',
  },
}

/**
 * Video starting at a specific position (30 seconds)
 */
export const WithInitialPosition: Story = {
  args: {
    src: sampleVideoUrl,
    title: 'Resume from saved position',
    initialPosition: 30,
  },
}

/**
 * Video player with captions/subtitles enabled
 */
export const WithCaptions: Story = {
  args: {
    src: sampleVideoUrl,
    title: 'Video with English and Spanish captions',
    captions: sampleCaptions,
  },
}

/**
 * Interactive example with external seek control
 */
export const WithExternalSeek: Story = {
  render: args => {
    const [seekTime, setSeekTime] = useState<number | undefined>(undefined)
    const [currentTime, setCurrentTime] = useState(0)

    const handleSeekToTimestamp = (time: number) => {
      setSeekTime(time)
    }

    const handleSeekComplete = () => {
      setSeekTime(undefined)
    }

    return (
      <div className="space-y-4">
        <div className="bg-card p-4 rounded-xl border">
          <h3 className="font-semibold mb-2">Timestamp Links (Click to jump)</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSeekToTimestamp(0)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              00:00 - Start
            </button>
            <button
              onClick={() => handleSeekToTimestamp(30)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              00:30 - Section 1
            </button>
            <button
              onClick={() => handleSeekToTimestamp(60)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              01:00 - Section 2
            </button>
            <button
              onClick={() => handleSeekToTimestamp(90)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              01:30 - Section 3
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Current time: {Math.floor(currentTime / 60)}:
            {String(Math.floor(currentTime % 60)).padStart(2, '0')}
          </p>
        </div>
        <VideoPlayer
          {...args}
          seekToTime={seekTime}
          onSeekComplete={handleSeekComplete}
          onTimeUpdate={time => {
            setCurrentTime(time)
            args.onTimeUpdate?.(time)
          }}
        />
      </div>
    )
  },
  args: {
    src: sampleVideoUrl,
    title: 'Video with external seek controls',
  },
}

/**
 * Video with time update tracking
 */
export const WithTimeTracking: Story = {
  render: args => {
    const [currentTime, setCurrentTime] = useState(0)
    const duration = 930 // Sample duration in seconds

    return (
      <div className="space-y-4">
        <VideoPlayer
          {...args}
          onTimeUpdate={time => {
            setCurrentTime(time)
            args.onTimeUpdate?.(time)
          }}
        />
        <div className="bg-card p-4 rounded-xl border">
          <h3 className="font-semibold mb-2">Playback Progress</h3>
          <div className="space-y-1 text-sm">
            <p>Current Time: {Math.floor(currentTime)}s</p>
            <p>Progress: {duration > 0 ? ((currentTime / duration) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>
      </div>
    )
  },
  args: {
    src: sampleVideoUrl,
    title: 'Video with time tracking display',
  },
}

/**
 * Alternative video source
 */
export const AlternativeVideo: Story = {
  args: {
    src: alternativeVideoUrl,
    title: 'Elephants Dream - Alternative Sample',
  },
}

/**
 * Video player with all features enabled
 */
export const FullyFeatured: Story = {
  render: args => {
    const [seekTime, setSeekTime] = useState<number | undefined>(undefined)
    const [currentTime, setCurrentTime] = useState(0)

    return (
      <div className="space-y-4">
        <div className="bg-card p-4 rounded-xl border">
          <h3 className="font-semibold mb-3">Interactive Controls</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-2">Jump to timestamp:</p>
              <div className="flex flex-wrap gap-2">
                {[0, 15, 30, 45, 60, 90, 120].map(time => (
                  <button
                    key={time}
                    onClick={() => setSeekTime(time)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                  >
                    {Math.floor(time / 60)}:{String(time % 60).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm">
                <strong>Current position:</strong> {Math.floor(currentTime / 60)}:
                {String(Math.floor(currentTime % 60)).padStart(2, '0')}
              </p>
            </div>
          </div>
        </div>
        <VideoPlayer
          {...args}
          seekToTime={seekTime}
          onSeekComplete={() => setSeekTime(undefined)}
          onTimeUpdate={time => {
            setCurrentTime(time)
            args.onTimeUpdate?.(time)
          }}
        />
        <div className="bg-card p-4 rounded-xl border">
          <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">Space</kbd> /{' '}
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">K</kbd> - Play/Pause
            </div>
            <div>
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">←</kbd> /{' '}
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">→</kbd> - Seek ±5s
            </div>
            <div>
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">↑</kbd> /{' '}
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">↓</kbd> - Volume ±5%
            </div>
            <div>
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">M</kbd> - Toggle Mute
            </div>
            <div>
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">F</kbd> - Toggle
              Fullscreen
            </div>
            <div>
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">C</kbd> - Toggle
              Captions
            </div>
            <div>
              <kbd className="px-2 py-0.5 bg-accent rounded text-xs font-mono">0-9</kbd> - Jump to
              0%-90%
            </div>
          </div>
        </div>
      </div>
    )
  },
  args: {
    src: sampleVideoUrl,
    title: 'Fully Featured Video Player Demo',
    captions: sampleCaptions,
    initialPosition: 0,
  },
}

/**
 * Responsive layout demonstration
 */
export const ResponsiveLayout: Story = {
  decorators: [
    Story => (
      <div className="space-y-6 p-4 bg-[#FAF5EE]">
        <div className="max-w-sm">
          <h3 className="font-semibold mb-2 text-sm">Mobile (320px)</h3>
          <Story />
        </div>
        <div className="max-w-2xl">
          <h3 className="font-semibold mb-2 text-sm">Tablet (768px)</h3>
          <Story />
        </div>
        <div className="max-w-4xl">
          <h3 className="font-semibold mb-2 text-sm">Desktop (1024px)</h3>
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    src: sampleVideoUrl,
    title: 'Responsive Video Player',
  },
  parameters: {
    layout: 'fullscreen',
  },
}

/**
 * Dark mode demonstration
 */
export const DarkMode: Story = {
  decorators: [
    Story => (
      <div className="bg-gray-900 p-8 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    src: sampleVideoUrl,
    title: 'Video Player in Dark Mode',
    captions: sampleCaptions,
  },
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
}

/**
 * Video player in a lesson context
 */
export const InLessonContext: Story = {
  decorators: [
    Story => (
      <div className="bg-[#FAF5EE] p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-card rounded-2xl p-6 border">
            <h1 className="text-2xl font-bold mb-2">
              Lesson 1: Introduction to Behavioral Analysis
            </h1>
            <p className="text-muted-foreground mb-4">
              Learn the fundamentals of reading human behavior and detecting deception.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Module 1</span>
              <span>•</span>
              <span>15 minutes</span>
              <span>•</span>
              <span>Beginner</span>
            </div>
          </div>
          <Story />
          <div className="bg-card rounded-2xl p-6 border">
            <h2 className="text-lg font-semibold mb-3">Key Topics Covered</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Understanding baseline behavior patterns</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Recognizing deviation from normal behavior</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Body language fundamentals</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    ),
  ],
  args: {
    src: sampleVideoUrl,
    title: 'Introduction to Behavioral Analysis',
    captions: sampleCaptions,
  },
  parameters: {
    layout: 'fullscreen',
  },
}
