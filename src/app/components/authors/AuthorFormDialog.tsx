import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Textarea } from '@/app/components/ui/textarea'
import { Badge } from '@/app/components/ui/badge'
import { Separator } from '@/app/components/ui/separator'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { flattenSpecialties } from '@/lib/authors'
import type { AuthorSocialLinks, ImportedAuthor } from '@/data/types'

interface FormErrors {
  name?: string
  avatar?: string
  website?: string
  linkedin?: string
  twitter?: string
}

/** Accept ImportedAuthor for edit mode */
type EditableAuthor = ImportedAuthor

interface AuthorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  author?: EditableAuthor // undefined = create mode, defined = edit mode
}

/** Append tokens from one input chunk (comma / semicolon / pipe aware) without case-insensitive dupes. */
function mergeSpecialtiesFromInput(existing: string[], chunk: string): string[] {
  const trimmed = chunk.trim()
  if (!trimmed) return existing
  const incoming = flattenSpecialties([trimmed])
  if (incoming.length === 0) return existing
  const seen = new Set(existing.map(s => s.toLowerCase()))
  const out = [...existing]
  for (const t of incoming) {
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true // empty is valid (optional)
  try {
    const parsed = new URL(value)
    // Only allow http(s) protocols to prevent javascript: injection
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    // silent-catch-ok: URL validation — invalid URL means false, no user feedback needed
    return false
  }
}

export function AuthorFormDialog({ open, onOpenChange, author }: AuthorFormDialogProps) {
  const addAuthor = useAuthorStore(s => s.addAuthor)
  const updateAuthor = useAuthorStore(s => s.updateAuthor)
  const isEditMode = !!author

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [shortBio, setShortBio] = useState('')
  const [specialties, setSpecialties] = useState<string[]>([])
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [education, setEducation] = useState('')
  const [avatar, setAvatar] = useState('')
  const [website, setWebsite] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [twitter, setTwitter] = useState('')
  const [featuredQuote, setFeaturedQuote] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** Avoid overwriting in-progress edits when `author` refreshes from sync (R5). */
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (!open) setIsDirty(false)
  }, [open])

  // Populate form when editing — skipped while user has typed into the form
  useEffect(() => {
    if (!open || !author || isDirty) return
    setName(author.name)
    setTitle(author.title ?? '')
    setBio(author.bio ?? '')
    setShortBio(author.shortBio ?? '')
    setSpecialties([...(author.specialties ?? [])])
    setSpecialtyInput('')
    setYearsExperience(author.yearsExperience ? String(author.yearsExperience) : '')
    setEducation(author.education ?? '')
    setAvatar(author.photoUrl ?? '')
    setWebsite(author.socialLinks?.website ?? '')
    setLinkedin(author.socialLinks?.linkedin ?? '')
    setTwitter(author.socialLinks?.twitter ?? '')
    setFeaturedQuote(author.featuredQuote ?? '')
    setErrors({})
  }, [open, author, isDirty])

  function resetForm() {
    setName('')
    setTitle('')
    setBio('')
    setShortBio('')
    setSpecialties([])
    setSpecialtyInput('')
    setYearsExperience('')
    setEducation('')
    setAvatar('')
    setWebsite('')
    setLinkedin('')
    setTwitter('')
    setFeaturedQuote('')
    setErrors({})
  }

  function validate(): FormErrors {
    const errs: FormErrors = {}

    if (!name.trim()) {
      errs.name = 'Author name is required'
    } else if (name.trim().length > 100) {
      errs.name = 'Name must be 100 characters or less'
    }

    if (avatar.trim() && !isValidUrl(avatar)) {
      errs.avatar = 'Please enter a valid URL (https://…)'
    }

    if (!isValidUrl(website)) {
      errs.website = 'Please enter a valid URL (https://…)'
    }

    if (!isValidUrl(linkedin)) {
      errs.linkedin = 'Please enter a valid URL (https://…)'
    }

    if (!isValidUrl(twitter)) {
      errs.twitter = 'Please enter a valid URL (https://…)'
    }

    return errs
  }

  function handleAddSpecialty() {
    const trimmed = specialtyInput.trim()
    if (!trimmed) {
      setSpecialtyInput('')
      return
    }
    setIsDirty(true)
    setSpecialties(prev => mergeSpecialtiesFromInput(prev, trimmed))
    setSpecialtyInput('')
  }

  function handleSpecialtyPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text/plain')
    if (!text.trim() || !/[,;|]/.test(text)) return
    e.preventDefault()
    const el = e.currentTarget
    const start = el.selectionStart ?? specialtyInput.length
    const end = el.selectionEnd ?? specialtyInput.length
    const combined = specialtyInput.slice(0, start) + text + specialtyInput.slice(end)
    setIsDirty(true)
    setSpecialties(prev => mergeSpecialtiesFromInput(prev, combined))
    setSpecialtyInput('')
  }

  function handleSpecialtyKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddSpecialty()
    }
  }

  function handleRemoveSpecialty(specialty: string) {
    setIsDirty(true)
    setSpecialties(prev => prev.filter(s => s !== specialty))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsSubmitting(true)

    const socialLinks: AuthorSocialLinks = {}
    if (website.trim()) socialLinks.website = website.trim()
    if (linkedin.trim()) socialLinks.linkedin = linkedin.trim()
    if (twitter.trim()) socialLinks.twitter = twitter.trim()

    const authorData = {
      name: name.trim(),
      title: title.trim() || undefined,
      bio: bio.trim() || undefined,
      shortBio: shortBio.trim() || undefined,
      specialties,
      yearsExperience:
        yearsExperience && Number(yearsExperience) > 0 ? Number(yearsExperience) : undefined,
      photoUrl: avatar.trim() || undefined,
      socialLinks,
      education: education.trim() || undefined,
      featuredQuote: featuredQuote.trim() || undefined,
    }

    try {
      if (isEditMode && author) {
        await updateAuthor(author.id, authorData)
        toast.success('Author updated')
      } else {
        await addAuthor(authorData)
        toast.success('Author created')
      }
      resetForm()
      onOpenChange(false)
    } catch (error) {
      // silent-catch-ok: store already shows toast.error to user; log for debugging
      console.error('[AuthorFormDialog] Submit failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent
        overlayClassName="bg-black/60 backdrop-blur-sm"
        className="flex max-h-[min(85vh,calc(100dvh-2rem))] min-h-0 min-w-0 flex-col gap-4 overflow-hidden overflow-x-hidden sm:max-w-lg"
      >
        <DialogHeader className="shrink-0 pr-12 text-center sm:text-left">
          <DialogTitle>{isEditMode ? 'Edit Author' : 'Create Author'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the author profile details.'
              : 'Add a new author to your learning library.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
          onInput={() => setIsDirty(true)}
          noValidate
        >
          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain">
            {/* ── Profile ── */}
            <div>
              <h3 className="font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-xs">
                Profile
              </h3>
              <Separator className="mb-3" />
              <div className="space-y-3">
                {/* Name (required) */}
                <div className="space-y-1.5">
                  <Label htmlFor="author-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="author-name"
                    placeholder="e.g., Jane Smith"
                    maxLength={100}
                    value={name}
                    onChange={e => {
                      setName(e.target.value)
                      if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
                    }}
                    required
                    aria-required="true"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'author-name-error' : undefined}
                    className="border-2"
                  />
                  {errors.name && (
                    <p id="author-name-error" role="alert" className="text-destructive text-xs">
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="author-title">Title</Label>
                  <Input
                    id="author-title"
                    placeholder="e.g., Software Engineering Expert"
                    maxLength={200}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="border-2"
                  />
                </div>

                {/* Short Bio */}
                <div className="space-y-1.5">
                  <Label htmlFor="author-short-bio">Short Bio</Label>
                  <Input
                    id="author-short-bio"
                    placeholder="Brief one-liner description"
                    maxLength={200}
                    value={shortBio}
                    onChange={e => setShortBio(e.target.value)}
                    className="border-2"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-1.5">
                  <Label htmlFor="author-bio">Bio</Label>
                  <Textarea
                    id="author-bio"
                    placeholder="Detailed biography..."
                    maxLength={2000}
                    rows={4}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    className="border-2"
                  />
                </div>

                {/* Specialties */}
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="author-specialties">Specialties</Label>
                  {specialties.length > 0 && (
                    <div className="mb-1.5 flex min-w-0 flex-wrap gap-1.5">
                      {specialties.map(specialty => (
                        <Badge
                          key={specialty}
                          variant="secondary"
                          className="max-w-full min-w-0 gap-1 break-words pr-1"
                        >
                          {specialty}
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecialty(specialty)}
                            className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                            aria-label={`Remove ${specialty}`}
                          >
                            <X className="size-3" aria-hidden="true" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Input
                    id="author-specialties"
                    placeholder="Enter or paste — commas split into tags"
                    value={specialtyInput}
                    onChange={e => setSpecialtyInput(e.target.value)}
                    onKeyDown={handleSpecialtyKeyDown}
                    onPaste={handleSpecialtyPaste}
                    onBlur={handleAddSpecialty}
                    className="min-w-0 border-2"
                  />
                </div>

                {/* Years of Experience */}
                <div className="space-y-1.5">
                  <Label htmlFor="author-experience">Years of Experience</Label>
                  <Input
                    id="author-experience"
                    type="number"
                    min="0"
                    placeholder="e.g., 10"
                    value={yearsExperience}
                    onChange={e => setYearsExperience(e.target.value)}
                    className="max-w-[10rem] border-2"
                  />
                </div>

                {/* Education */}
                <div className="space-y-1.5">
                  <Label htmlFor="author-education">Education</Label>
                  <Input
                    id="author-education"
                    placeholder="e.g., PhD Computer Science, MIT"
                    maxLength={200}
                    value={education}
                    onChange={e => setEducation(e.target.value)}
                    className="max-w-[16rem] border-2"
                  />
                </div>
              </div>
            </div>

            {/* ── Media ── */}
            <Separator />
            <div>
              <h3 className="font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-xs">
                Media
              </h3>
              <Separator className="mb-3" />
              <div className="space-y-3">
                {/* Avatar URL */}
                <div className="space-y-1.5">
                  <Label htmlFor="author-avatar">Avatar URL</Label>
                  <Input
                    id="author-avatar"
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={avatar}
                    onChange={e => {
                      setAvatar(e.target.value)
                      if (errors.avatar) setErrors(prev => ({ ...prev, avatar: undefined }))
                    }}
                    aria-invalid={!!errors.avatar}
                    aria-describedby={errors.avatar ? 'author-avatar-error' : undefined}
                    className="font-mono text-xs border-2"
                  />
                  {errors.avatar && (
                    <p id="author-avatar-error" role="alert" className="text-destructive text-xs">
                      {errors.avatar}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Links ── */}
            <Separator />
            <div>
              <h3 className="font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-xs">
                Links
              </h3>
              <Separator className="mb-3" />
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="author-website">Website</Label>
                  <Input
                    id="author-website"
                    type="url"
                    placeholder="https://example.com"
                    value={website}
                    onChange={e => {
                      setWebsite(e.target.value)
                      if (errors.website) setErrors(prev => ({ ...prev, website: undefined }))
                    }}
                    aria-invalid={!!errors.website}
                    aria-describedby={errors.website ? 'author-website-error' : undefined}
                    className="font-mono text-xs border-2"
                  />
                  {errors.website && (
                    <p id="author-website-error" role="alert" className="text-destructive text-xs">
                      {errors.website}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="author-linkedin">LinkedIn</Label>
                  <Input
                    id="author-linkedin"
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={linkedin}
                    onChange={e => {
                      setLinkedin(e.target.value)
                      if (errors.linkedin) setErrors(prev => ({ ...prev, linkedin: undefined }))
                    }}
                    aria-invalid={!!errors.linkedin}
                    aria-describedby={errors.linkedin ? 'author-linkedin-error' : undefined}
                    className="font-mono text-xs border-2"
                  />
                  {errors.linkedin && (
                    <p id="author-linkedin-error" role="alert" className="text-destructive text-xs">
                      {errors.linkedin}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="author-twitter">Twitter</Label>
                  <Input
                    id="author-twitter"
                    type="url"
                    placeholder="https://twitter.com/username"
                    value={twitter}
                    onChange={e => {
                      setTwitter(e.target.value)
                      if (errors.twitter) setErrors(prev => ({ ...prev, twitter: undefined }))
                    }}
                    aria-invalid={!!errors.twitter}
                    aria-describedby={errors.twitter ? 'author-twitter-error' : undefined}
                    className="font-mono text-xs border-2"
                  />
                  {errors.twitter && (
                    <p id="author-twitter-error" role="alert" className="text-destructive text-xs">
                      {errors.twitter}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Quote ── */}
            <Separator />
            <div>
              <h3 className="font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-xs">
                Quote
              </h3>
              <Separator className="mb-3" />
              <div className="space-y-3">
                {/* Featured Quote */}
                <div className="space-y-1.5">
                  <Label htmlFor="author-quote">Featured Quote</Label>
                  <Input
                    id="author-quote"
                    placeholder="A memorable quote from the author"
                    maxLength={300}
                    value={featuredQuote}
                    onChange={e => setFeaturedQuote(e.target.value)}
                    className="border-2"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-border border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Author'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
