import { useState, useRef, useEffect, useMemo } from 'react'

export function useHoverPreview(delay = 1000) {
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const handlers = useMemo(
    () => ({
      onMouseEnter: () => {
        timerRef.current = setTimeout(() => setActive(true), delay)
      },
      onMouseLeave: () => {
        clearTimeout(timerRef.current)
        setActive(false)
      },
    }),
    [delay]
  )

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return { active, handlers } as const
}
