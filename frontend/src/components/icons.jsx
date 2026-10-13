function Base({ children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconCalendarCheck(props) {
  return (
    <Base {...props}>
      <path d="M4.2 6.1c0-1 .8-1.9 1.9-1.9h11.8c1 0 1.9.9 1.9 1.9v11.3c0 1-.9 1.9-1.9 1.9H6.1c-1 0-1.9-.9-1.9-1.9Z" />
      <path d="M4.2 9.4h15.6" />
      <path d="M8.3 2.8v3.1M15.7 2.8v3.1" />
      <path d="m9.4 14.6 2.1 2.1 3.4-3.9" />
    </Base>
  );
}

export function IconPulseShield(props) {
  return (
    <Base {...props}>
      <path d="M12 2.9 5 5.4v5.3c0 4.4 2.9 7.6 7 9.4 4.1-1.8 7-5 7-9.4V5.4Z" />
      <path d="M7.6 12h2.3l1.2-2.6 1.7 4.8 1.2-2.2h2.4" />
    </Base>
  );
}

export function IconChartBars(props) {
  return (
    <Base {...props}>
      <path d="M3.8 3.8v15.4h16.4" />
      <path d="M8.2 15.4v-4.6M12.3 15.4V7.6M16.4 15.4v-6.9" />
      <circle cx="16.6" cy="6.4" r="1.3" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconCareTeam(props) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8.2" r="3.1" />
      <path d="M3.6 19.2c.6-3 2.8-4.7 5.4-4.7s4.8 1.7 5.4 4.7" />
      <circle cx="16.9" cy="9.4" r="2.4" />
      <path d="M15.9 14.7c2.3.2 3.9 1.7 4.4 4" />
    </Base>
  );
}

export function IconTrophy(props) {
  return (
    <Base {...props}>
      <path d="M8 4.2h8v4.6c0 2.6-1.8 4.4-4 4.4s-4-1.8-4-4.4Z" />
      <path d="M8 5.4H5.2c0 2.9 1.4 4.6 3.5 5.1M16 5.4h2.8c0 2.9-1.4 4.6-3.5 5.1" />
      <path d="M12 13.2v2.6M8.7 20.2h6.6M10.2 15.8h3.6l.5 4.4h-4.6Z" />
      <path d="m12 6.6.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2Z" />
    </Base>
  );
}

export function IconStar(props) {
  return (
    <Base {...props}>
      <path d="m12 3.4 2.3 4.9 5.3.6-3.9 3.6.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.9-3.6 5.3-.6Z" />
    </Base>
  );
}

export function IconFlame(props) {
  return (
    <Base {...props}>
      <path d="M12 2.9c.4 3-1.2 4.4-2.5 6C8.3 10.2 7.3 11.4 7.3 13.4c0 2.7 2 4.9 4.7 4.9s4.7-2.2 4.7-4.9c0-1.5-.7-2.7-1.5-3.9-.5 1-1.1 1.6-2.1 2 .4-2.3-.3-5.4-1.1-8.6Z" />
      <path d="M12 20.6c-1.2 0-2.2-1-2.2-2.3 0-1 .6-1.7 1.2-2.4.5-.6 1-1.2 1-2.1 1 1 2.4 2.3 2.4 4.5 0 1.3-1.1 2.3-2.4 2.3Z" />
    </Base>
  );
}

export function IconArrowRight(props) {
  return (
    <Base {...props}>
      <path d="M3.5 12h16M14.4 6.2l5.8 5.8-5.8 5.8" />
    </Base>
  );
}

export function IconArrowUp(props) {
  return (
    <Base {...props}>
      <path d="M12 20.5v-16M6.2 9.6 12 3.8l5.8 5.8" />
    </Base>
  );
}

export function IconPlusCross(props) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 8.4v7.2M8.4 12h7.2" />
    </Base>
  );
}

export function IconTicket(props) {
  return (
    <Base {...props}>
      <path d="M4 8.2c0-1 .8-1.9 1.9-1.9h12.2c1 0 1.9.9 1.9 1.9v1.6c0 1-1.4 1.2-2 2-.6.9-.6 2.5 0 3.4.6.8 2 1 2 2v1.6c0 1-.9 1.9-1.9 1.9H5.9c-1.1 0-1.9-.9-1.9-1.9v-1.6c0-1 1.4-1.2 2-2 .6-.9.6-2.5 0-3.4-.6-.8-2-1-2-2Z" />
      <path d="M13.5 6.4v2M13.5 10.7v1.9M13.5 14.8v1.9M13.5 18.8v1.9" strokeDasharray="0.2 2.1" />
    </Base>
  );
}

export function IconEye(props) {
  return (
    <Base {...props}>
      <path d="M2.8 12S6 5.9 12 5.9 21.2 12 21.2 12 18 18.1 12 18.1 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Base>
  );
}

export function IconEyeOff(props) {
  return (
    <Base {...props}>
      <path d="M4.3 4.3l15.4 15.4" />
      <path d="M9.9 6.2c.7-.2 1.4-.3 2.1-.3 6 0 9.2 6.1 9.2 6.1a17.6 17.6 0 0 1-2.8 3.4M6 7.5A16.4 16.4 0 0 0 2.8 12S6 18.1 12 18.1c1 0 2-.2 2.8-.5" />
      <path d="M9.9 9.9a2.8 2.8 0 0 0 4 4" />
    </Base>
  );
}
