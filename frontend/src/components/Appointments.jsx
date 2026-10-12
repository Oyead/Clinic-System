export function StatusFilter({ id, value, onChange }) {
  return (
    <label style={{ flex: 1 }}>
      Status filter
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
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
    <div className="user-row">
      <span className="who">
        #{appointment.id} {appointment.patient_name || ''} → {appointment.doctor_name || ''}
        <br />
        {appointment.clinic_name || ''} · {when} · {appointment.status}
        {appointment.reason ? ` · ${appointment.reason}` : ''}
      </span>
      {appointment.status === 'pending' && onDecide && (
        <>
          <button type="button" className="approve" onClick={() => onDecide(appointment.id, 'approve')}>
            Approve
          </button>
          <button type="button" className="reject" onClick={() => onDecide(appointment.id, 'reject')}>
            Reject
          </button>
        </>
      )}
      {(appointment.status === 'pending' || appointment.status === 'scheduled') && onCancel && (
        <button type="button" onClick={() => onCancel(appointment.id)}>
          Cancel
        </button>
      )}
    </div>
  );
}

export function AppointmentList({ appointments, emptyText, onDecide, onCancel }) {
  if (!appointments.length) return <p className="muted">{emptyText}</p>;
  return (
    <>
      {appointments.map((a) => (
        <AppointmentRow key={a.id} appointment={a} onDecide={onDecide} onCancel={onCancel} />
      ))}
    </>
  );
}
