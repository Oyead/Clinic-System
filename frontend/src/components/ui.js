export const SURFACE = 'bg-white rounded-[24px] shadow-[var(--shadow)]';

export const SURFACE_MD = 'bg-white rounded-[24px] shadow-[var(--shadow)]';

export const SURFACE_SOFT = 'bg-[var(--color-sand)] rounded-[20px]';

export const MODAL_BACKDROP = 'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-4 bg-[rgba(40,32,22,0.35)] backdrop-blur-[6px] sm:items-center';

export const EYEBROW = 'text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--color-ink-soft)]';

export const SECTION_TITLE = 'font-display text-[1.5rem] font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-ink)]';

export const FORM_INPUT = 'w-full min-w-0 rounded-[18px] border-0 bg-[var(--color-sand)] px-4 py-3 text-[0.95rem] leading-[1.4] text-[var(--color-ink)] shadow-[inset_0_1px_2px_rgba(80,62,40,0.06)] transition-colors placeholder:text-[var(--color-ink-soft)]/70 focus:bg-white focus:outline-2 focus:outline-[var(--color-mustard)] focus:outline-offset-2 disabled:opacity-60';

export const BTN_BASE = 'inline-flex cursor-pointer items-center whitespace-nowrap justify-center gap-2 rounded-full font-display font-bold transition-[transform,background-color,color,box-shadow] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-[var(--color-mustard)] focus-visible:outline-offset-2';

export const BTN_PRIMARY = `${BTN_BASE} bg-[var(--color-ink)] text-white shadow-[0_12px_24px_-14px_rgba(17,17,17,0.6)] hover:bg-[#2a2a2a]`;

export const BTN_SECONDARY = `${BTN_BASE} bg-white text-[var(--color-ink)] shadow-[var(--shadow-sm)] hover:bg-[#fbf7f0]`;

export const BTN_SUCCESS = `${BTN_BASE} bg-[rgba(127,217,168,0.24)] text-[#2f7d58] hover:bg-[rgba(127,217,168,0.4)]`;

export const BTN_SUCCESS_INK = BTN_SUCCESS;

export const BTN_DANGER = `${BTN_BASE} bg-[rgba(248,161,136,0.22)] text-[#b4492f] hover:bg-[rgba(248,161,136,0.38)]`;

export const BTN_INK = BTN_PRIMARY;

export const BTN_GHOST = `${BTN_BASE} bg-white text-[var(--color-ink)] shadow-[var(--shadow-sm)] hover:bg-[#fbf7f0]`;

export const BTN_ICON = 'inline-flex h-10 cursor-pointer w-10 shrink-0 items-center justify-center rounded-full border-0 bg-white text-[var(--color-ink-soft)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-sand)] hover:text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-[var(--color-mustard)] focus-visible:outline-offset-2';

const PILL_BASE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.66rem] font-bold uppercase tracking-[0.08em] leading-[1.6] text-white';

const STATUS_PILLS = {
  pending: `${PILL_BASE} bg-[#8d6717]`,
  scheduled: `${PILL_BASE} bg-[#2f7d58]`,
  approved: `${PILL_BASE} bg-[#2f7d58]`,
  active: `${PILL_BASE} bg-[#2f7d58]`,
  open: `${PILL_BASE} bg-[#2f7d58]`,
  completed: `${PILL_BASE} bg-[#4f4fd0]`,
  cancelled: `${PILL_BASE} bg-[#b4492f]`,
  rejected: `${PILL_BASE} bg-[#b4492f]`,
  suspended: `${PILL_BASE} bg-[#b4492f]`,
  offboarded: `${PILL_BASE} bg-[#6f6559]`,
  no_show: `${PILL_BASE} bg-[#6f6559]`,
  invited: `${PILL_BASE} bg-[#8d6717]`,
  pending_verification: `${PILL_BASE} bg-[#8d6717]`,
  inactive: `${PILL_BASE} bg-[#6f6559]`,
};

export function statusPill(status) {
  return STATUS_PILLS[status] || `${PILL_BASE} bg-[#6f6559]`;
}
