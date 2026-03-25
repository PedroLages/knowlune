/**
 * Pomodoro timer audio notifications using Web Audio API.
 *
 * Generates a pleasant two-tone chime (C5 -> E5) without any audio file
 * dependency. Works offline and provides precise volume control.
 *
 * Requires a prior user gesture (satisfied by the timer start button).
 */

export function playChime(volume: number = 0.5): void {
  if (volume <= 0) return

  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    // Pleasant two-tone chime: C5 -> E5
    oscillator.type = 'sine'
    oscillator.frequency.value = 523.25 // C5
    gain.gain.value = Math.min(1, Math.max(0, volume))
    oscillator.start()

    // Transition to second tone
    oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15) // E5

    // Fade out
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    oscillator.stop(ctx.currentTime + 0.5)

    // Cleanup
    oscillator.onended = () => {
      ctx.close().catch(() => {
        // AudioContext.close() can fail if already closed
      })
    }
  } catch {
    // Audio failure should never block timer flow
  }
}
