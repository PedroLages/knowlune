import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Download, Upload, Trash2, Save, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { PageLayout } from './_PageLayout'

function SettingsContent() {
  const [displayName, setDisplayName] = useState('Pedro')
  const [bio, setBio] = useState(
    'Self-directed learner focused on behavioral analysis and influence.'
  )
  const [theme, setTheme] = useState('system')
  const [saved, setSaved] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="name" className="text-sm font-medium block mb-1">
                Display Name
              </label>
              <Input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="bio" className="text-sm font-medium block mb-1">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell something about yourself..."
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
            <Button onClick={handleSave} className="gap-2">
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : 'Save Profile'}
            </Button>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="text-sm font-medium block mb-2">Theme</label>
            <div className="flex gap-2">
              {['system', 'light', 'dark'].map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    theme === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Export Data
              </Button>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" /> Import Data
              </Button>
            </div>

            <div className="pt-4 border-t border-border">
              {!showResetConfirm ? (
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => setShowResetConfirm(true)}
                >
                  <Trash2 className="w-4 h-4" /> Reset All Data
                </Button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="font-semibold text-red-900 mb-1">Are you sure?</h4>
                  <p className="text-sm text-red-700 mb-4">
                    This will permanently delete all your progress, journal entries, and settings.
                    This action cannot be undone. Consider exporting your data first.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700">
                      Reset Everything
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>LevelUp v0.1.0</span>
              <Badge variant="secondary" className="text-xs">
                Beta
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Personal learning platform for The Operative Kit by Chase Hughes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SettingsPage() {
  return (
    <PageLayout activePath="/settings">
      <SettingsContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Settings',
  component: SettingsPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof SettingsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
