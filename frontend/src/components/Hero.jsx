import {
  IconArrowRight,
  IconCalendarCheck,
  IconCareTeam,
  IconChartBars,
  IconFlame,
  IconPulseShield,
  IconStar,
  IconTicket,
  IconTrophy,
} from './icons.jsx';

function HeroArt() {
  return (
    <svg viewBox="0 0 520 460" className="hero-art" role="img" aria-label="Trophy, progress ring and care rewards illustration">
      <g fill="#1B7FE0" opacity="0.35">
        {Array.from({ length: 4 }).map((_, r) =>
          Array.from({ length: 5 }).map((_, c) => (
            <circle key={`${r}-${c}`} cx={392 + c * 22} cy={36 + r * 22} r="4" />
          )),
        )}
      </g>
      <circle cx="96" cy="372" r="62" fill="none" stroke="#0E7C6B" strokeWidth="2.5" opacity="0.5" />
      <circle cx="96" cy="372" r="46" fill="none" stroke="#0E7C6B" strokeWidth="1.5" strokeDasharray="4 7" opacity="0.45" />

      <circle cx="205" cy="225" r="148" fill="#C7DFF3" />
      <circle cx="205" cy="225" r="148" fill="none" stroke="#0F2B46" strokeWidth="3" opacity="0.9" />

      <g>
        <path d="M150 168h110v52c0 32-24 52-55 52s-55-20-55-52Z" fill="#0F2B46" />
        <path d="M150 182h-34c0 34 17 54 42 59M260 182h34c0 34-17 54-42 59" fill="none" stroke="#0F2B46" strokeWidth="10" strokeLinecap="round" />
        <rect x="196" y="272" width="18" height="34" fill="#0F2B46" />
        <path d="M176 330h58l-8 34h-42Z" fill="#0E7C6B" />
        <rect x="168" y="318" width="74" height="12" rx="6" fill="#0F2B46" />
        <circle cx="205" cy="216" r="30" fill="#FFFFFF" />
        <path
          d="m205 194 6.6 13.8 15 1.9-11 10.4 2.8 14.8-13.4-7.3-13.4 7.3 2.8-14.8-11-10.4 15-1.9Z"
          fill="#E8A33D"
        />
      </g>

      <g transform="translate(372 268)">
        <circle r="74" fill="#FFFFFF" stroke="#0F2B46" strokeWidth="3" />
        <circle
          r="58"
          fill="none"
          stroke="#D3E3F2"
          strokeWidth="14"
        />
        <circle
          r="58"
          fill="none"
          stroke="#1B7FE0"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray="284 365"
          transform="rotate(-90)"
        />
        <text x="0" y="-4" textAnchor="middle" className="hero-ring-pct">78%</text>
        <text x="0" y="18" textAnchor="middle" className="hero-ring-label">CARE SCORE</text>
      </g>

      <g transform="translate(288 96) rotate(8)">
        <rect x="0" y="0" width="132" height="64" rx="14" fill="#0E7C6B" />
        <circle cx="0" cy="32" r="10" fill="#D9E7F3" />
        <circle cx="132" cy="32" r="10" fill="#D9E7F3" />
        <path d="M28 22h44M28 34h30" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
        <path d="m94 20 5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1Z" fill="#FFFFFF" />
      </g>

      <g transform="translate(52 92) rotate(-7)">
        <rect x="0" y="0" width="118" height="60" rx="30" fill="#FFFFFF" stroke="#0F2B46" strokeWidth="3" />
        <path
          d="M34 12c1 8-3 12-6.5 15.5C24.5 30.5 22 33 22 38c0 7 5.4 12.5 12 12.5S46 45 46 38c0-4-1.8-7-3.8-10-.5 2.6-2.6 4-5.2 4.8.8-6-.5-13.4-3-20.8Z"
          fill="#1B7FE0"
        />
        <text x="56" y="28" className="hero-chip-num">120</text>
        <text x="56" y="44" className="hero-chip-label">CREDITS</text>
      </g>

      <g>
        <rect x="330" y="150" width="16" height="16" rx="4" fill="#0E7C6B" transform="rotate(18 338 158)" />
        <circle cx="120" cy="200" r="8" fill="#1B7FE0" />
        <rect x="452" y="180" width="14" height="14" rx="7" fill="#E8A33D" />
        <path d="m70 280 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill="#0E7C6B" />
        <path d="m468 340 5 11 11 5-11 5-5 11-5-11-11-5 11-5Z" fill="#1B7FE0" />
      </g>
    </svg>
  );
}

const RAIL = [
  { icon: IconFlame, tint: 'tint-blue', value: 'Credits that pay off', note: 'Fee waivers, perks and priority slots' },
  { icon: IconStar, tint: 'tint-teal', value: 'Badge unlocked', note: 'Early bird — booked before 9am' },
  { icon: IconTicket, tint: 'tint-sky', value: 'Next visit ready', note: 'Ticket #1042 · Tue 10:30' },
];

const FEATURES = [
  {
    icon: IconCalendarCheck,
    title: 'Book in seconds',
    text: 'Pick a clinic and doctor, choose a time, done. Your request lands straight in the care queue.',
  },
  {
    icon: IconCareTeam,
    title: 'Care team queue',
    text: 'Doctors and receptionists review each request, then approve, reject or cancel in one click.',
  },
  {
    icon: IconChartBars,
    title: 'Owner reports',
    text: 'Appointments by status, load per doctor and billing totals — level up with real numbers.',
  },
  {
    icon: IconPulseShield,
    title: 'Roles that protect',
    text: 'Admin, owner, staff and patient scopes keep every action safe, audited and accountable.',
  },
];

export function Hero({ onGetStarted }) {
  return (
    <section className="landing">
      <div className="hero-grid">
        <div className="hero-copy glass">
          <h2 className="hero-title">
            Your health,
            <br />
            levelled up.
          </h2>
          <p className="hero-sub">
            Book visits in seconds. Complete them to earn platform credits
            and keep your Reliable Patient badge — then redeem fee waivers,
            partner perks and priority slots.
          </p>
          <div className="hero-cta">
            <button type="button" className="btn-primary" onClick={onGetStarted}>
              Start earning
              <IconArrowRight />
            </button>
            <a className="btn-ghost" href="#how-it-plays">
              How it plays
            </a>
          </div>
          <dl className="hero-stats">
            <div>
              <dt>Credits redeemed</dt>
              <dd>48k</dd>
            </div>
            <div>
              <dt>Visits booked</dt>
              <dd>120k</dd>
            </div>
            <div>
              <dt>Care score</dt>
              <dd>4.9</dd>
            </div>
          </dl>
        </div>

        <div className="hero-stage">
          <a className="stage-link" href="#/signup" aria-label="Start earning — join the platform">
            <HeroArt />
          </a>
        </div>

        <aside className="hero-rail" aria-label="Your progress preview">
          {RAIL.map((c) => (
            <div className="rail-card glass" key={c.value}>
              <span className={`rail-icon ${c.tint}`}>
                <c.icon />
              </span>
              <div>
                <p className="rail-value">{c.value}</p>
                <p className="rail-note">{c.note}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>

      <div className="feature-grid" id="how-it-plays">
        {FEATURES.map((f, i) => (
          <article className={`feature-card ${i % 2 ? 'solid' : 'glass'}`} key={f.title}>
            <span className="feature-icon">
              <f.icon />
            </span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </article>
        ))}
      </div>
      
    </section>
  );
}
