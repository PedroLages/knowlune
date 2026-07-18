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
import { Separator } from '@/app/components/ui/separator'
import { useAuthorStore } from '@/stores/useAuthorStore'
import type { AuthorSocialLinks, ImportedAuthor } from '@/data/types'

interface FormErrors {
  name?: string
  avatar?: string
  website?: string
  linkedin?: string
  twitter?: string
  instagram?: string
  youtube?: string
}

/** Accept ImportedAuthor for edit mode */
type EditableAuthor = ImportedAuthor

interface AuthorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  author?: EditableAuthor // undefined = create mode, defined = edit mode
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

function normalizeSpecialties(values: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of values) {
    for (const part of value.split(/[,;]/)) {
      const specialty = part.trim()
      const key = specialty.toLocaleLowerCase()
      if (!specialty || seen.has(key)) continue
      seen.add(key)
      normalized.push(specialty)
    }
  }

  return normalized
}

export function AuthorFormDialog({ open, onOpenChange, author }: AuthorFormDialogProps) {
  const addAuthor = useAuthorStore(s => s.addAuthor)
  const updateAuthor = useAuthorStore(s => s.updateAuthor)
  const isEditMode = !!author

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [shortBio, setShortBio] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [education, setEducation] = useState('')
  const [specialties, setSpecialties] = useState<string[]>([])
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [avatar, setAvatar] = useState('')
  const [website, setWebsite] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [twitter, setTwitter] = useState('')
  const [instagram, setInstagram] = useState('')
  const [youtube, setYoutube] = useState('')
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
    setYearsExperience(author.yearsExperience ? String(author.yearsExperience) : '')
    setEducation(author.education ?? '')
    setSpecialties(normalizeSpecialties(author.specialties ?? []))
    setSpecialtyInput('')
    setAvatar(author.photoUrl ?? '')
    setWebsite(author.socialLinks?.website ?? '')
    setLinkedin(author.socialLinks?.linkedin ?? '')
    setTwitter(author.socialLinks?.twitter ?? '')
    setInstagram(author.socialLinks?.instagram ?? '')
    setYoutube(author.socialLinks?.youtube ?? '')
    setFeaturedQuote(author.featuredQuote ?? '')
    setErrors({})
  }, [open, author, isDirty])

  function resetForm() {
    setName('')
    setTitle('')
    setBio('')
    setShortBio('')
    setYearsExperience('')
    setEducation('')
    setSpecialties([])
    setSpecialtyInput('')
    setAvatar('')
    setWebsite('')
    setLinkedin('')
    setTwitter('')
    setInstagram('')
    setYoutube('')
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

    if (!isValidUrl(instagram)) {
      errs.instagram = 'Please enter a valid URL (https://…)'
    }

    if (!isValidUrl(youtube)) {
      errs.youtube = 'Please enter a valid URL (https://…)'
    }

    return errs
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
    if (instagram.trim()) socialLinks.instagram = instagram.trim()
    if (youtube.trim()) socialLinks.youtube = youtube.trim()

    const normalizedSpecialties = normalizeSpecialties([...specialties, specialtyInput])
    const authorData = {
      name: name.trim(),
      title: title.trim() || undefined,
      bio: bio.trim() || undefined,
      shortBio: shortBio.trim() || undefined,
      yearsExperience:
        yearsExperience && Number(yearsExperience) > 0 ? Number(yearsExperience) : undefined,
      photoUrl: avatar.trim() || undefined,
      socialLinks,
      education: education.trim() || undefined,
      specialties: normalizedSpecialties,
      featuredQuote: featuredQuote.trim() || undefined,
    }

    try {
      if (isEditMode && author) {
        await updateAuthor(author.id, authorData)
        toast.success('Author updated')
      } else {
        const result = await addAuthor(authorData)
        if (!result) {
          // Duplicate detected — store already showed toast, just bail
          setIsSubmitting(false)
          return
        }
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

  function addSpecialties(values: string[]) {
    setSpecialties(current => normalizeSpecialties([...current, ...values]))
    setSpecialtyInput('')
    setIsDirty(true)
  }

  function commitSpecialtyInput() {
    if (!specialtyInput.trim()) return
    addSpecialties([specialtyInput])
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
                <div className="space-y-1.5">
                  <Label htmlFor="author-specialties">Specialties</Label>
                  <div className="rounded-md border-2 border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring/50">
                    {specialties.length > 0 && (
                      <div
                        className="mb-2 flex min-w-0 flex-wrap gap-1.5"
                        aria-label="Added specialties"
                      >
                        {specialties.map(specialty => (
                          <span
                            key={specialty.toLocaleLowerCase()}
                            className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground"
                          >
                            <span className="max-w-full truncate" title={specialty}>
                              {specialty}
                            </span>
                            <button
                              type="button"
                              className="-my-2.5 -mr-2.5 grid size-11 shrink-0 place-items-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Remove ${specialty}`}
                              onClick={() => {
                                setSpecialties(current =>
                                  current.filter(item => item !== specialty)
                                )
                                setIsDirty(true)
                              }}
                            >
                              <X className="size-3" aria-hidden="true" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <Input
                      id="author-specialties"
                      value={specialtyInput}
                      onChange={event => setSpecialtyInput(event.target.value)}
                      onBlur={commitSpecialtyInput}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
                          event.preventDefault()
                          commitSpecialtyInput()
                        }
                      }}
                      onPaste={event => {
                        const pasted = event.clipboardData.getData('text')
                        if (!/[,;]/.test(pasted)) return
                        event.preventDefault()
                        addSpecialties([pasted])
                      }}
                      placeholder="Type a specialty, then press Enter"
                      aria-describedby="author-specialties-help"
                      className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <p id="author-specialties-help" className="text-xs text-muted-foreground">
                    Press Enter, comma, or semicolon to add a specialty.
                  </p>
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

                <div className="space-y-1.5">
                  <Label htmlFor="author-instagram">Instagram</Label>
                  <Input
                    id="author-instagram"
                    type="url"
                    placeholder="https://instagram.com/username"
                    value={instagram}
                    onChange={e => {
                      setInstagram(e.target.value)
                      if (errors.instagram) setErrors(prev => ({ ...prev, instagram: undefined }))
                    }}
                    aria-invalid={!!errors.instagram}
                    aria-describedby={errors.instagram ? 'author-instagram-error' : undefined}
                    className="font-mono text-xs border-2"
                  />
                  {errors.instagram && (
                    <p
                      id="author-instagram-error"
                      role="alert"
                      className="text-destructive text-xs"
                    >
                      {errors.instagram}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="author-youtube">YouTube</Label>
                  <Input
                    id="author-youtube"
                    type="url"
                    placeholder="https://youtube.com/@channel"
                    value={youtube}
                    onChange={e => {
                      setYoutube(e.target.value)
                      if (errors.youtube) setErrors(prev => ({ ...prev, youtube: undefined }))
                    }}
                    aria-invalid={!!errors.youtube}
                    aria-describedby={errors.youtube ? 'author-youtube-error' : undefined}
                    className="font-mono text-xs border-2"
                  />
                  {errors.youtube && (
                    <p id="author-youtube-error" role="alert" className="text-destructive text-xs">
                      {errors.youtube}
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
