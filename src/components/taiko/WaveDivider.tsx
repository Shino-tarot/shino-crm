// 「潮」の世界観をさりげなく添えるための、金の細い波線装飾。
// 情報量を持たないため装飾目的である旨をaria-hiddenで明示する。
export function WaveDivider() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 16"
      className="taiko-wave-divider"
      preserveAspectRatio="none"
    >
      <path
        d="M0 8 C 15 0, 25 16, 40 8 S 65 0, 80 8 S 105 16, 120 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
