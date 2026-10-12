export function LogoEmblem({ size = 56 }) {
  return (
    <span className="emblem" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 96 96" width={size} height={size}>
        <defs>
          <path id="emblem-ring" d="M48 12a36 36 0 1 1 0 72 36 36 0 1 1 0-72" fill="none" />
        </defs>
        <circle cx="48" cy="48" r="46" className="emblem-disc" />
        <circle cx="48" cy="48" r="36" fill="none" className="emblem-orbit" strokeWidth="1.4" strokeDasharray="3 5" />
        <text className="emblem-ring-text">
          <textPath href="#emblem-ring">CARE LEVELED UP • CLINIC SYSTEM •</textPath>
        </text>
        <g className="emblem-mark" fill="none" strokeWidth="4.5" strokeLinecap="round">
          <path d="M48 34v28M34 48h28" />
        </g>
        <path
          className="emblem-pulse"
          d="M36 52h6l3-6 4 11 3-5h8"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
