import { useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { FORM_INPUT, BTN_PRIMARY, BTN_SECONDARY, MODAL_BACKDROP, SURFACE, statusPill } from './ui.js';

const formatMoney = (cents, currency = 'EGP') => {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return `${currency} 0.00`;
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
};

const formatWhen = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function PaymentDialog({ token, appointment, onClose, onPaid, notify }) {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [configRes, statusRes] = await Promise.all([
          api.paymentConfig(token),
          api.appointmentPayment(token, appointment.id),
        ]);
        if (cancelled) return;
        if (configRes.ok) setConfig(await configRes.json());
        if (!statusRes.ok) {
          setError(await readError(statusRes, 'Could not load payment details.'));
        } else {
          const data = await statusRes.json();
          setStatus(data);
          setPhone(data.patient_phone || '');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, appointment.id]);

  const pay = async () => {
    if (!status) return;
    if (status.payment_status === 'paid') {
      onPaid?.();
      return;
    }
    if (!phone.trim()) {
      setError('Enter a phone number for the payment receipt.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.createPaymentIntention(token, appointment.id, {
        phone_number: phone.trim(),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.checkout_url) {
        localStorage.setItem('clinic_pending_payment_appt', String(appointment.id));
        window.location.assign(payload.checkout_url);
        return;
      }
      if (res.ok && payload.already_paid) {
        notify?.('This appointment is already paid.', 'success');
        onPaid?.();
        return;
      }
      setError(payload.error || (await readError(res, 'Could not start payment.')));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const paid = status && status.payment_status === 'paid';
  const amount = status ? formatMoney(status.amount_cents, status.currency) : '';
  const due = status && status.payment_due_at ? formatWhen(status.payment_due_at) : '';

  return (
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div
        className={`${SURFACE} w-full max-w-[520px] p-6 sm:p-8`}
        role="dialog"
        aria-modal="true"
        aria-label="Pay for appointment"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[0.66rem] font-bold uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">Appointment payment</span>
            <h2 className="mt-1.5 font-display text-[1.55rem] font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-ink)]">
              {appointment.doctor_name || 'Consultation'}
            </h2>
            <p className="mt-1 text-[0.84rem] leading-[1.6] text-[var(--color-ink-soft)]">
              {appointment.clinic_name || 'Clinic'} · {formatWhen(appointment.appointment_date)}
            </p>
          </div>
          <span className={statusPill(paid ? 'scheduled' : 'awaiting_payment')}>{paid ? 'paid' : 'awaiting payment'}</span>
        </div>

        {loading ? (
          <p className="mt-6 text-[0.88rem] font-medium text-[var(--color-ink-soft)]">Loading payment details…</p>
        ) : (
          <>
            <div className="mt-6 rounded-[20px] bg-[var(--color-sand)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[0.78rem] font-bold uppercase tracking-[0.1em] text-[var(--color-ink-soft)]">Amount</span>
                <strong className="font-display text-[1.45rem] font-extrabold text-[var(--color-ink)]">{amount}</strong>
              </div>
              {due && !paid && (
                <p className="mt-2 text-[0.8rem] font-medium text-[#8d6717]">Pay before {due} to keep this slot.</p>
              )}
              {paid && (
                <p className="mt-2 text-[0.8rem] font-medium text-[#2f7d58]">Payment received. Your appointment is confirmed.</p>
              )}
            </div>

            {config && !config.enabled && !paid && (
              <p className="mt-4 rounded-[16px] bg-[rgba(245,196,77,0.28)] px-4 py-3 text-[0.8rem] font-medium text-[#6b5109]" role="status">
                Online payment is not configured yet. Ask the clinic to contact support.
              </p>
            )}

            {!paid && (
              <label className="mt-4 flex flex-col gap-1.5 text-[0.78rem] font-bold text-[var(--color-ink)]">
                Phone number for the payment receipt
                <input
                  type="tel"
                  className={`${FORM_INPUT} bg-white`}
                  value={phone}
                  onChange={(event) => { setError(''); setPhone(event.target.value); }}
                  placeholder="+20 100 000 0000"
                  autoComplete="tel"
                />
              </label>
            )}

            {error && (
              <p className="mt-4 rounded-[16px] bg-[rgba(248,161,136,0.18)] px-4 py-3 text-[0.82rem] font-medium text-[#a8442d]" role="alert">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className={`${BTN_SECONDARY} px-5 py-2.5 text-sm`} onClick={onClose}>
                {paid ? 'Close' : 'Not now'}
              </button>
              {!paid && (
                <button
                  type="button"
                  className={`${BTN_PRIMARY} px-6 py-2.5 text-sm`}
                  onClick={pay}
                  disabled={submitting || !status || (config && !config.enabled)}
                >
                  {submitting ? 'Starting payment…' : 'Pay now'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
