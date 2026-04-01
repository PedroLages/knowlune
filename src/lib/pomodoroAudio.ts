/**
 * Pomodoro timer audio notifications.
 *
 * Supports both synthesized chimes (Web Audio API) and file-based sounds
 * from the sound library in public/sounds/pomodoro/.
 *
 * Requires a prior user gesture (satisfied by the timer start button).
 */

/** Available notification sounds with display names */
export const POMODORO_SOUNDS = [
  { id: 'chime', label: 'Chime (default)', file: null },
  { id: 'alarm-clock', label: 'Alarm Clock', file: '/sounds/pomodoro/sophiahalmen-alarm-clock-207274.mp3' },
  { id: 'timer-complete', label: 'Timer Complete', file: '/sounds/pomodoro/alexis_gaming_cam-timer-terminer-342934.mp3' },
  { id: 'clock-alarm', label: 'Clock Alarm', file: '/sounds/pomodoro/microsammy-clock-alarm-8761.mp3' },
  { id: 'gentle-bell', label: 'Gentle Bell', file: '/sounds/pomodoro/sergei_spas--476798.mp3' },
  { id: 'timer-ticks', label: 'Timer Ticks', file: '/sounds/pomodoro/kakaist-timer-ticks-314055.mp3' },
] as const

export type PomodoroSoundId = (typeof POMODORO_SOUNDS)[number]['id']

/** Play the synthesized two-tone chime (C5 → E5) */
function playSynthChime(volume: number): void {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.value = 523.25 // C5
    gain.gain.value = Math.min(1, Math.max(0, volume))
    oscillator.start()

    oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15) // E5
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    oscillator.stop(ctx.currentTime + 0.5)

    oscillator.onended = () => {
      ctx.close().catch(() => {})
    }
  } catch {
    // Audio failure should never block timer flow
  }
}

/** Play an audio file at the given volume */
function playAudioFile(src: string, volume: number): void {
  try {
    const audio = new Audio(src)
    audio.volume = Math.min(1, Math.max(0, volume))
    audio.play().catch(() => {
      // Autoplay blocked or file missing — silently degrade
    })
  } catch {
    // Audio failure should never block timer flow
  }
}

/**
 * Play a Pomodoro notification sound.
 *
 * @param soundId - which sound to play (defaults to 'chime')
 * @param volume - 0 to 1
 */
export function playChime(volume: number = 0.5, soundId: PomodoroSoundId = 'chime'): void {
  if (volume <= 0) return

  const sound = POMODORO_SOUNDS.find(s => s.id === soundId)
  if (!sound || !sound.file) {
    playSynthChime(volume)
  } else {
    playAudioFile(sound.file, volume)
  }
}

/**
 * Preview a sound (for the sound selector UI).
 * Same as playChime but always plays at the given volume.
 */
export function previewSound(soundId: PomodoroSoundId, volume: number = 0.5): void {
  playChime(volume, soundId)
}
