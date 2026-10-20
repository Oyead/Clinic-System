import { FORM_INPUT, BTN_SUCCESS, BTN_DANGER, BTN_INK, statusPill } from './ui.js';

export function StatusFilter({ id, value, onChange }) {
  return (
    <label className="flex flex-col gap-1.5 text-[0.78rem] font-bold text-[var(--color-ink)]">
      Status filter
      <select
        className={FORM_INPUT}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">all statuses</option>
        <option value="pending">pending</option>
        <option value="scheduled">scheduled</option>
        <option value="completed">completed</option>
        <option value="cancelled">cancelled</option>
        <option value="no_show">no_show</option>
      </select>
    </label>
  );
}

export function AppointmentRow({ appointment, onDecide, onCancel }) {
  const when = new Date(appointment.appointment_date).toLocaleString();
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-[var(--color-line)] py-4 text-sm first:border-t-0">
      <span className="min-w-0 flex-1 leading-[1.65] text-[var(--color-ink)] [overflow-wrap:anywhere]">
        <span className="font-bold">#{appointment.id}</span> {appointment.patient_name || ''} → {appointment.doctor_name || ''}
        <br />
        <span className="text-[0.82rem] text-[var(--color-ink-soft)]">
          {appointment.clinic_name || ''} · {when}
        </span>
        {' '}
        <span className={statusPill(appointment.status)}>{appointment.status.replaceAll('_', ' ')}</span>
        {appointment.reason ? <span className="text-[0.82rem] text-[var(--color-ink-soft)]"> · {appointment.reason}</span> : ''}
      </span>
      <span className="flex w-full flex-wrap gap-2 sm:w-auto">
        {appointment.status === 'pending' && onDecide && (
          <>
            <button type="button" className={`${BTN_SUCCESS} px-3.5 py-1.5 text-xs`} onClick={() => onDecide(appointment.id, 'approve')}>
              Approve
            </button>
            <button type="button" className={`${BTN_DANGER} px-3.5 py-1.5 text-xs`} onClick={() => onDecide(appointment.id, 'reject')}>
              Reject
            </button>
          </>
        )}
        {(appointment.status === 'pending' || appointment.status === 'scheduled') && onCancel && (
          <button type="button" className={`${BTN_INK} px-3.5 py-1.5 text-xs`} onClick={() => onCancel(appointment.id)}>
            Cancel
          </button>
        )}
      </span>
    </div>
  );
}

export function AppointmentList({ appointments, emptyText, onDecide, onCancel }) {
  if (!appointments.length) return <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">{emptyText}</p>;
  return (
    <div className="flex flex-col divide-y divide-[var(--color-line)]">
      {appointments.map((a) => (
        <AppointmentRow key={a.id} appointment={a} onDecide={onDecide} onCancel={onCancel} />
      ))}
    </div>
  );
}
