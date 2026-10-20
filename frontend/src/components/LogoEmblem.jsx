export function LogoEmblem({ size = 56 }) {
  return (
    <span className="inline-flex" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 96 96" width={size} height={size}>
        <circle cx="48" cy="48" r="46" fill="#111111" />
        <circle cx="48" cy="48" r="35" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" strokeDasharray="3 5" />
        <g stroke="#ffffff" strokeWidth="5" strokeLinecap="round">
          <path d="M48 33v30M33 48h30" />
        </g>
        <circle cx="70" cy="26" r="7" fill="#f5c44d" />
      </svg>
    </span>
  );
}
