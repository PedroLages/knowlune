// E51-S02: Synchronously apply .reduce-motion class before first paint.
// Prevents 50-200ms flash of animations before React hydrates.
// Must load before any stylesheets via <script src> in index.html <head>.
try {
  var s = JSON.parse(localStorage.getItem('app-settings'))
  if (s && s.reduceMotion === 'on') {
    document.documentElement.classList.add('reduce-motion')
  } else if (
    (!s || !s.reduceMotion || s.reduceMotion === 'system') &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    document.documentElement.classList.add('reduce-motion')
  }
} catch (e) {
  // Ignore parse errors — defaults to no class (follow system)
}
