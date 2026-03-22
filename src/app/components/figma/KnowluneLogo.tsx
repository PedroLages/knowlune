export function KnowluneLogo() {
  return (
    <svg
      viewBox="0 0 200 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-auto"
      aria-label="Knowlune"
      role="img"
    >
      {/* Wordmark: "Know" */}
      <text
        x="0"
        y="36"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="currentColor"
        letterSpacing="-1"
      >
        Know
      </text>
      {/* "lune" */}
      <text
        x="88"
        y="36"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="currentColor"
        letterSpacing="-1"
      >
        lune
      </text>
      {/* Crescent moon accent between "Know" and "lune" */}
      <path
        d="M84,12 A10,10 0 1,1 84,32 A7,7 0 1,0 84,12"
        className="fill-brand"
        opacity="0.85"
      />
    </svg>
  )
}
