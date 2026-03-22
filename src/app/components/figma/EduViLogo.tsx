export function EduViLogo() {
  return (
    <svg
      viewBox="0 0 130 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-auto"
      aria-label="EduVi"
      role="img"
    >
      {/* Wordmark: "Edu" */}
      <text
        x="0"
        y="36"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="currentColor"
        letterSpacing="-1"
      >
        Edu
      </text>
      {/* "V" */}
      <text
        x="70"
        y="36"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="currentColor"
        letterSpacing="-1"
      >
        V
      </text>
      {/* "i" */}
      <text
        x="96"
        y="36"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="currentColor"
        letterSpacing="-1"
      >
        i
      </text>
      {/* Hidden arrow in negative space between V and i */}
      <polygon points="90,31 96,18 102,31" className="fill-background" />
      <rect x="94.5" y="30" width="3" height="10" className="fill-background" />
    </svg>
  )
}
