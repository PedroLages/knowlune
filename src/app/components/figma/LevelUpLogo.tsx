export function LevelUpLogo() {
  return (
    <svg
      viewBox="0 0 180 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-auto"
      aria-label="LevelUp"
      role="img"
    >
      {/* Wordmark: "Level" */}
      <text
        x="0"
        y="36"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="currentColor"
        letterSpacing="-1"
      >
        Level
      </text>
      {/* "U" */}
      <text
        x="94"
        y="36"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="currentColor"
        letterSpacing="-1"
      >
        U
      </text>
      {/* "p" */}
      <text
        x="118"
        y="36"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="currentColor"
        letterSpacing="-1"
      >
        p
      </text>
      {/* Hidden arrow in negative space between U and p */}
      <polygon points="112,31 118,18 124,31" className="fill-background" />
      <rect x="116.5" y="30" width="3" height="10" className="fill-background" />
    </svg>
  )
}
