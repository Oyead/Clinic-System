import {
  IconArrowRight,
  IconCalendarCheck,
  IconCareTeam,
  IconChartBars,
  IconFlame,
  IconPulseShield,
  IconStar,
  IconTicket,
} from './icons.jsx';
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW } from './ui.js';

const RAIL = [
  { icon: IconFlame, value: 'Earn credits for every completed visit', note: 'Redeem them for fee waivers, partner perks, and priority slots.' },
  { icon: IconStar, value: 'Badge unlocked', note: 'Early bird - booked before 9am' },
  { icon: IconTicket, value: 'Next visit ready', note: 'Ticket #1042 · Tue 10:30' },
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
    text: 'Appointments by status, load per doctor, and billing totals - real numbers, not guesswork.',
  },
  {
    icon: IconPulseShield,
    title: 'Roles that protect',
    text: 'Admin, owner, staff and patient scopes keep every action safe, audited and accountable.',
  },
];

export function Hero({ onGetStarted }) {
  return (
    <section className="flex flex-col gap-6 sm:gap-8">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-6 rounded-[24px] bg-white p-7 shadow-[var(--shadow)] sm:p-10 lg:col-span-7 lg:gap-7 lg:p-[48px]">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-sand)] px-4 py-1.5 text-[0.66rem] font-bold uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-mustard)]" />
            Care, levelled up
          </span>
          <h1 className="font-display text-[clamp(2rem,11vw,4.6rem)] font-extrabold leading-[0.95] tracking-[-0.045em] text-[var(--color-ink)] lg:text-[clamp(3.2rem,5.6vw,4.8rem)]">
            Your health,
            <br />
            levelled up.
          </h1>
          <p className="max-w-[36ch] text-[1.02rem] leading-[1.65] text-[var(--color-ink-soft)] lg:text-[1.08rem]">
Book visits in seconds. Show up, earn credits, unlock perks. Credits never affect your care - they’re just our way of saying thanks.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={`${BTN_PRIMARY} px-6 py-3.5 text-sm`} onClick={onGetStarted}>
              Start now
              <IconArrowRight className="h-4 w-4" />
            </button>
          </div>
          <dl className="mt-1 grid grid-cols-3 gap-3 border-t border-[var(--color-line)] pt-6 sm:gap-4">
            <div className="flex flex-col-reverse gap-0.5">
              <dt className={EYEBROW}>Credits redeemed</dt>
              <dd className="font-display text-[1.35rem] font-extrabold tracking-[-0.03em] text-[var(--color-ink)] sm:text-[1.5rem] lg:text-[1.9rem]">48k</dd>
            </div>
            <div className="flex flex-col-reverse gap-0.5">
              <dt className={EYEBROW}>Visits booked</dt>
              <dd className="font-display text-[1.35rem] font-extrabold tracking-[-0.03em] text-[var(--color-ink)] sm:text-[1.5rem] lg:text-[1.9rem]">120k</dd>
            </div>
            <div className="flex flex-col-reverse gap-0.5">
              <dt className={EYEBROW}>Care score</dt>
              <dd className="font-display text-[1.35rem] font-extrabold tracking-[-0.03em] text-[var(--color-ink)] sm:text-[1.5rem] lg:text-[1.9rem]">4.9</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <div className="rounded-[24px] bg-[var(--color-mustard)] p-7 shadow-[var(--shadow)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-[#6b5109]">Visit length</span>
                <p className="font-display text-[clamp(3.4rem,14vw,7rem)] font-extrabold leading-[0.85] tracking-[-0.06em] text-[var(--color-ink)]">45m</p>
                <p className="mt-3 max-w-[24ch] text-[0.88rem] leading-[1.6] text-[#4a3606]">
                  Every open slot is a full 45-minute visit - no rushed appointments.
                </p>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-2 rounded-[24px] bg-white p-3 shadow-[var(--shadow)]" aria-label="Your progress preview">
            {RAIL.map((c) => (
              <div key={c.value} className="flex items-center gap-3.5 rounded-[18px] bg-[var(--color-sand)] p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-ink)] shadow-[var(--shadow-sm)]">
                  <c.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.94rem] font-bold leading-[1.35] text-[var(--color-ink)]">{c.value}</p>
                  <p className="mt-0.5 text-[0.78rem] leading-[1.5] text-[var(--color-ink-soft)]">{c.note}</p>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" id="how-it-plays">
        {FEATURES.map((f) => (
          <article key={f.title} className="flex min-w-0 flex-col gap-4 rounded-[24px] bg-white p-6 shadow-[var(--shadow)] sm:p-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-sand)] text-[var(--color-ink)]">
              <f.icon className="h-5 w-5" />
            </span>
            <h2 className="font-display text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--color-ink)]">{f.title}</h2>
            <p className="text-[0.88rem] leading-[1.65] text-[var(--color-ink-soft)]">{f.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
