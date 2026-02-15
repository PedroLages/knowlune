import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import {
  Bot,
  Send,
  Sparkles,
  FileText,
  BookOpen,
  Link2,
  AlertCircle,
  Settings,
  CheckCircle,
  MessageSquare,
  Brain,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { PageLayout } from './_PageLayout'

const chatMessages = [
  { role: 'user' as const, content: 'How do custom hooks work in React?' },
  {
    role: 'assistant' as const,
    content: `Based on your notes, here's what you've learned about custom hooks:

**Custom hooks** extract reusable stateful logic from components. Key points from your notes:

1. **Naming convention**: Always start with "use" (e.g., \`useFormValidation\`, \`useLocalStorage\`)
2. **Composition**: Custom hooks can call other hooks (useState, useEffect, etc.)
3. **State isolation**: Each component using a custom hook gets its own state copy

From your note in *React Patterns — Custom Hooks* ([5:12]):
> "Custom hooks let you share logic, not state. Each component gets its own independent copy."

From *React Patterns — useEffect Basics* ([8:45]):
> "useEffect cleanup is crucial when hooks manage subscriptions or timers."

**Related topics in your notes:**
- Context API usage patterns
- Performance optimization with useMemo/useCallback`,
    sources: [
      { lesson: 'Custom Hooks', course: 'React Patterns', timestamp: '5:12' },
      { lesson: 'useEffect Basics', course: 'React Patterns', timestamp: '8:45' },
    ],
  },
]

const knowledgeGaps = [
  {
    topic: 'Error Boundaries',
    course: 'React Patterns',
    lesson: 'Error Boundaries',
    reason: 'Mentioned in 3 lessons but no notes taken',
    priority: 'high',
  },
  {
    topic: 'React Suspense',
    course: 'React Patterns',
    lesson: 'React Suspense',
    reason: 'Referenced in Custom Hooks notes but not studied',
    priority: 'medium',
  },
  {
    topic: 'Statement Analysis',
    course: 'The Ellipsis Manual',
    lesson: 'Statement Analysis',
    reason: 'Module 3 gap — prerequisite for Interview Techniques',
    priority: 'high',
  },
  {
    topic: 'Proxemics',
    course: 'Body Language Mastery',
    lesson: 'Proxemics & Space Usage',
    reason: 'Brief mention in notes but no deep study',
    priority: 'low',
  },
]

const connections = [
  {
    from: 'Rapport Building (NLP)',
    to: 'Body Positioning (Body Language)',
    reason:
      'Mirror and match techniques directly apply posture mirroring from Body Language module',
  },
  {
    from: 'Baseline Behavior (Ellipsis)',
    to: 'Observational Techniques (Ellipsis)',
    reason: 'Baseline establishment is the foundation for all observational methods',
  },
  {
    from: 'Influence Principles (Behavioral Table)',
    to: 'Language Patterns (NLP)',
    reason: 'Authority principle maps to Milton Model patterns for indirect suggestion',
  },
]

function AIAssistantContent() {
  const [activeTab, setActiveTab] = useState<
    'chat' | 'summary' | 'gaps' | 'connections' | 'config'
  >('chat')
  const [query, setQuery] = useState('')

  const tabs = [
    { id: 'chat' as const, label: 'Q&A', icon: MessageSquare },
    { id: 'summary' as const, label: 'Summary', icon: FileText },
    { id: 'gaps' as const, label: 'Gaps', icon: Search },
    { id: 'connections' as const, label: 'Connections', icon: Link2 },
    { id: 'config' as const, label: 'Settings', icon: Settings },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Learning Assistant</h1>
          <p className="text-sm text-muted-foreground">Powered by your notes and study data</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-card border border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* Q&A Chat */}
      {activeTab === 'chat' && (
        <div className="flex flex-col h-[600px]">
          <Card className="rounded-[24px] flex-1 flex flex-col">
            <CardContent className="p-6 flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-auto space-y-4 mb-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-violet-600" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                        msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {'sources' in msg && msg.sources && (
                        <div className="mt-3 pt-3 border-t border-border/30 space-y-1">
                          <p className="text-xs font-medium opacity-70">Sources:</p>
                          {msg.sources.map((src, si) => (
                            <button
                              key={si}
                              className="block text-xs text-blue-600 hover:underline"
                            >
                              [{src.timestamp}] {src.lesson} — {src.course}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question about your notes..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="flex-1"
                />
                <Button className="bg-blue-600 hover:bg-blue-700 shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Video Summary */}
      {activeTab === 'summary' && (
        <Card className="rounded-[24px]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold">Generate Video Summary</h3>
                <p className="text-sm text-muted-foreground">
                  Currently viewing:{' '}
                  <span className="text-foreground">Nonverbal Deception Cues</span>
                </p>
              </div>
              <Button className="bg-violet-600 hover:bg-violet-700 gap-2">
                <Sparkles className="w-4 h-4" /> Generate Summary
              </Button>
            </div>

            {/* Sample generated summary */}
            <div className="bg-muted rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <h4 className="font-semibold text-sm">AI Summary — Nonverbal Deception Cues</h4>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <h5 className="font-medium mb-1">Key Concepts</h5>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>
                      • Deception creates cognitive load, leading to observable behavioral changes
                    </li>
                    <li>• Baseline comparison is essential — no single cue indicates deception</li>
                    <li>• Cluster analysis: look for 3+ simultaneous indicators</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-medium mb-1">Takeaways</h5>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Practice baseline observation before attempting deception detection</li>
                    <li>• Focus on deviations from normal, not specific "tells"</li>
                    <li>• Context matters — stress can mimic deception indicators</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-medium mb-1">Related Topics</h5>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Statement Analysis
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Interview Techniques
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Baseline Behavior
                    </Badge>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic">
                Add notes to this lesson for more personalized summaries.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Gaps */}
      {activeTab === 'gaps' && (
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-5 h-5 text-amber-500" />
              Knowledge Gap Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {knowledgeGaps.map((gap, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 p-4 rounded-xl border ${
                  gap.priority === 'high'
                    ? 'border-amber-200 bg-amber-50'
                    : gap.priority === 'medium'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-border bg-card'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    gap.priority === 'high'
                      ? 'bg-amber-500'
                      : gap.priority === 'medium'
                        ? 'bg-blue-500'
                        : 'bg-gray-400'
                  }`}
                />
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{gap.topic}</h4>
                  <p className="text-xs text-muted-foreground">{gap.reason}</p>
                  <span className="text-xs text-muted-foreground">
                    {gap.course} — {gap.lesson}
                  </span>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> Review
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Concept Connections */}
      {activeTab === 'connections' && (
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-500" />
              Concept Connections Across Courses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              AI-identified connections between concepts in your notes across different courses.
            </p>
            {connections.map((conn, i) => (
              <div key={i} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {conn.from}
                  </Badge>
                  <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Badge variant="secondary" className="text-xs">
                    {conn.to}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{conn.reason}</p>
              </div>
            ))}
            <Button variant="outline" className="w-full gap-2 mt-2">
              <Sparkles className="w-4 h-4" /> Find More Connections
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI Config */}
      {activeTab === 'config' && (
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">AI Provider Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 max-w-lg">
            <div>
              <label className="text-sm font-medium block mb-2">AI Provider</label>
              <div className="flex gap-2">
                {['OpenAI', 'Anthropic'].map((p, i) => (
                  <button
                    key={p}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      i === 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="apikey" className="text-sm font-medium block mb-2">
                API Key
              </label>
              <Input
                id="apikey"
                type="password"
                placeholder="sk-..."
                defaultValue="sk-••••••••••••••••••••••••"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your API key is stored locally and never sent to our servers.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="gap-2">
                <CheckCircle className="w-4 h-4" /> Test API Key
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">Save</Button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-700">
                API key verified — connection successful
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AIAssistantPage() {
  return (
    <PageLayout activePath="/messages">
      <AIAssistantContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/AI Assistant',
  component: AIAssistantPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof AIAssistantPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoApiKey: Story = {
  render: () => (
    <PageLayout activePath="/messages">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Learning Assistant</h1>
            <p className="text-sm text-muted-foreground">Powered by your notes and study data</p>
          </div>
        </div>
        <Card className="rounded-[24px]">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI Not Configured</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              To use AI features, configure your API key in Settings. Supports OpenAI and Anthropic
              providers.
            </p>
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-medium mx-auto transition-colors">
              <Settings className="w-4 h-4" /> Configure AI Provider
            </button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}
