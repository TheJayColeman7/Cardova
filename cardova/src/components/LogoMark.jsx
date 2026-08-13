export default function LogoMark({ variant = "dark", className = "" }) {
  const isDark = variant === "dark";
  const cardFill = "#7EB8D4";
  const outline = isDark ? "#FFFFFF" : "#0B1F3A";
  const batter = isDark ? "#0B1F3A" : "#FFFFFF";

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="8"
        y="28"
        width="42"
        height="58"
        rx="5"
        fill={cardFill}
        stroke={outline}
        strokeWidth="3"
        transform="rotate(-18 29 57)"
      />
      <rect
        x="22"
        y="24"
        width="42"
        height="58"
        rx="5"
        fill={cardFill}
        stroke={outline}
        strokeWidth="3"
        transform="rotate(-8 43 53)"
      />
      <path
        d="M48 14 L92 12 C93 26 94.2 44 95.2 62 C96.2 78 97 90 90 92 L84 93 L81.5 106 C78 114 72 118 64 118 C58 118 55.5 112 54 106 L51.5 94 L22 92 C20.5 78 21 64 22 50 C20.8 40 20 32 25 28 L28 20 C31 16 40 14.5 48 14 Z"
        fill={cardFill}
        stroke={outline}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g fill={batter} transform="translate(46 38) scale(0.92)">
        <circle cx="18" cy="7" r="5.2" />
        <path d="M14.5 13 L22 13 L24 28 L20.5 28 L19.2 20 L17.5 28 L14 28 L16.2 19.5 L13.5 28 L10.2 27.2 L14.5 13 Z" />
        <path d="M10 27 L6 40 L10.5 41 L13.2 32 L15 41.5 L19.2 40.5 L16.8 31 L20.8 40 L25 38.5 L20 26.5 Z" />
        <rect x="24.5" y="8" width="3.2" height="22" rx="1.4" transform="rotate(28 26 19)" />
      </g>
    </svg>
  );
}
