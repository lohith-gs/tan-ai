export default function Logo({
  width = 80,
  height = 45,
  iconOnly = false,
}: {
  width?: number;
  height?: number;
  iconOnly?: boolean;
}) {
  if (iconOnly) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="5" y1="18" x2="43" y2="18" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.65" />
        <path d="M 22 18 Q 30 18 30 28" stroke="#60a5fa" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <line x1="30" y1="28" x2="30" y2="43" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="22" cy="18" r="4" fill="#3b82f6" fillOpacity="0.12" />
        <circle cx="22" cy="18" r="3" fill="#1d4ed8" />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 190 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text x="22" y="24" fontFamily="Georgia, serif" fontSize="15" fontStyle="italic" fill="#60a5fa">
        tan
      </text>
      <line x1="14" y1="36" x2="130" y2="36" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.65" />
      <path d="M 84 36 Q 94 36 94 58" stroke="#60a5fa" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <line x1="94" y1="58" x2="94" y2="104" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="84" cy="36" r="9" fill="#3b82f6" fillOpacity="0.1" />
      <circle cx="84" cy="36" r="4.5" fill="#1d4ed8" />
      <text x="16" y="84" fontFamily="-apple-system, sans-serif" fontSize="34" fontWeight="800" fill="#f0f4ff" letterSpacing="-0.5">
        <tspan fill="#3b82f6">(</tspan>
        AI
        <tspan fill="#60a5fa">)</tspan>
      </text>
    </svg>
  );
}
