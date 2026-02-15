import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Trophy, Target, Flame, CheckCircle, Plus, Timer, Zap, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { PageLayout } from './_PageLayout'

const activeChallenges = [
  {
    id: '1',
    title: 'Complete 5 Lessons This Week',
    type: 'completion' as const,
    target: 5,
    current: 3,
    deadline: '2026-02-21',
    pct: 60,
    icon: Target,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: '2',
    title: '10 Hours of Study',
    type: 'time' as const,
    target: 600,
    current: 420,
    deadline: '2026-02-28',
    pct: 70,
    icon: Timer,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    id: '3',
    title: '7-Day Study Streak',
    type: 'streak' as const,
    target: 7,
    current: 4,
    deadline: undefined,
    pct: 57,
    icon: Flame,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
]

const completedChallenges = [
  {
    id: '4',
    title: 'Finish Body Language Module 2',
    type: 'completion' as const,
    completedAt: '2026-02-10',
  },
  { id: '5', title: '5 Hours of Study', type: 'time' as const, completedAt: '2026-02-08' },
  { id: '6', title: '3-Day Streak', type: 'streak' as const, completedAt: '2026-02-05' },
]

const suggestions = [
  {
    title: 'Complete 3 lessons today',
    type: 'completion',
    icon: Target,
    description: 'Finish 3 lessons in any course',
  },
  {
    title: 'Study for 2 hours',
    type: 'time',
    icon: Timer,
    description: 'Accumulate 2 hours of study time',
  },
  {
    title: '14-day study streak',
    type: 'streak',
    icon: Flame,
    description: 'Study every day for 2 weeks',
  },
  {
    title: 'Finish a course',
    type: 'completion',
    icon: Trophy,
    description: 'Complete all lessons in any one course',
  },
]

function ChallengesContent() {
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Learning Challenges</h1>
          <p className="text-muted-foreground text-sm mt-1">Set goals and track your progress</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 gap-2"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="w-4 h-4" /> New Challenge
        </Button>
      </div>

      {/* Create Challenge Panel */}
      {showCreate && (
        <Card className="rounded-[24px] mb-6 border-blue-200 bg-blue-50/50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Quick Start — Choose a Challenge</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestions.map((s, i) => {
                const Icon = s.icon
                return (
                  <button
                    key={i}
                    className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:shadow-md transition-all text-left"
                    onClick={() => setShowCreate(false)}
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{s.title}</h4>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <button className="text-sm text-blue-600 hover:underline font-medium">
                + Create custom challenge
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Challenges */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" /> Active Challenges
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {activeChallenges.map(challenge => {
            const Icon = challenge.icon
            return (
              <Card key={challenge.id} className="rounded-[24px] hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-10 h-10 ${challenge.bgColor} rounded-xl flex items-center justify-center`}
                    >
                      <Icon className={`w-5 h-5 ${challenge.color}`} />
                    </div>
                    <div>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {challenge.type}
                      </Badge>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-3">{challenge.title}</h3>
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{challenge.pct}%</span>
                    </div>
                    <Progress value={challenge.pct} className="h-3" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {challenge.type === 'time'
                        ? `${Math.round(challenge.current / 60)}h / ${Math.round(challenge.target / 60)}h`
                        : `${challenge.current} / ${challenge.target}`}
                    </span>
                    {challenge.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due{' '}
                        {new Date(challenge.deadline).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Completed Challenges */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" /> Completed ({completedChallenges.length})
        </h2>
        <div className="space-y-2">
          {completedChallenges.map(challenge => (
            <Card key={challenge.id} className="rounded-xl">
              <CardContent className="p-4 flex items-center gap-4">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{challenge.title}</h4>
                  <span className="text-xs text-muted-foreground">
                    Completed {new Date(challenge.completedAt).toLocaleDateString()}
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {challenge.type}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function ChallengesPage() {
  return (
    <PageLayout activePath="/my-class">
      <ChallengesContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Challenges',
  component: ChallengesPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ChallengesPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithCreatePanel: Story = {
  render: () => (
    <PageLayout activePath="/my-class">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Learning Challenges</h1>
            <p className="text-muted-foreground text-sm mt-1">Set goals and track your progress</p>
          </div>
        </div>
        <Card className="rounded-[24px] mb-6 border-blue-200 bg-blue-50/50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Quick Start — Choose a Challenge</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestions.map((s, i) => {
                const Icon = s.icon
                return (
                  <button
                    key={i}
                    className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:shadow-md transition-all text-left"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{s.title}</h4>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}

export const EmptyChallenges: Story = {
  render: () => (
    <PageLayout activePath="/my-class">
      <div>
        <h1 className="text-2xl font-bold mb-6">Learning Challenges</h1>
        <Card className="rounded-[24px]">
          <CardContent className="p-12 text-center">
            <Trophy className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No challenges yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first learning challenge to set goals and stay motivated.
            </p>
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-medium mx-auto transition-colors">
              <Plus className="w-4 h-4" /> Create Challenge
            </button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}
