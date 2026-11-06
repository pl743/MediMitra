import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { useAuth } from '../context/useAuth.js';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

const cancellableStatuses = new Set(['booked', 'confirmed']);

function doctorName(appointment) {
  const doctor = appointment.doctorId;
  if (!doctor) return appointment.bookingDetails?.doctorName || 'Doctor';
  return `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
}

function formatAppointmentTime(value) {
  if (!value) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function statusStyle(status) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-800';
  if (status === 'cancelled' || status === 'no_show') return 'bg-slate-100 text-slate-700';
  if (status === 'confirmed') return 'bg-blue-50 text-blue-800';
  return 'bg-amber-50 text-amber-900';
}

export function MyAppointmentsPage() {
  const { setUser } = useAuth();
  const [appointmentResult, setAppointmentResult] = useState(null);
  const [actionError, setActionError] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const requestKey = `${page}:${reloadKey}`;
  const isLoading = appointmentResult?.requestKey !== requestKey;
  const appointments = isLoading ? [] : appointmentResult.appointments;
  const error = isLoading ? '' : appointmentResult.error;
  const pagination = isLoading ? null : appointmentResult.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;

  useEffect(() => {
    let active = true;
    withAuthRefresh(() => api.get('/appointments/my', { params: { page, limit: 10 } }))
      .then(({ data }) => {
        if (active) {
          setAppointmentResult({
            requestKey,
            appointments: data.data.appointments,
            pagination: data.data.pagination,
            error: '',
          });
        }
      })
      .catch((requestError) => {
        if (active) {
          if (requestError.response?.status === 401) setUser(null);
          setAppointmentResult({
            requestKey,
            appointments: [],
            pagination: null,
            error: getApiErrorMessage(
              requestError,
              'Your appointments could not be loaded. Check your connection and try again.'
            ),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [page, reloadKey, requestKey, setUser]);

  async function cancelAppointment(appointment) {
    if (!cancellableStatuses.has(appointment.status) || cancellingId) return;
    if (!window.confirm('Cancel this appointment? The time will be released if cancellation succeeds.')) return;

    setCancellingId(appointment._id);
    setActionError('');
    try {
      await withAuthRefresh(() => api.patch(`/appointments/${appointment._id}/cancel`, {}));
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      if (requestError.response?.status === 401) setUser(null);
      setActionError(
        getApiErrorMessage(
          requestError,
          'We could not cancel this appointment. Refresh and check its current status.'
        )
      );
    } finally {
      setCancellingId('');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Review appointments linked to your patient account. Only you can access this list."
        eyebrow="Your care"
        icon={CalendarDays}
        title="My appointments"
      />
      {actionError && (
        <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {actionError}
        </p>
      )}
      {isLoading ? (
        <LoadingState label="Loading your appointments" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : appointments.length === 0 ? (
        <EmptyState
          message="When you book an appointment, it will appear here."
          title="You have no appointments yet"
        />
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => {
            const startTime = appointment.bookingDetails?.slotStartTime;
            const provider = appointment.providerId;
            const canCancel = cancellableStatuses.has(appointment.status);

            return (
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" key={appointment._id}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-800">
                      <CalendarDays aria-hidden="true" size={22} />
                    </span>
                    <div>
                      <h2 className="font-bold text-ink">{doctorName(appointment)}</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {provider?.name || appointment.bookingDetails?.providerName || 'Healthcare provider'}
                      </p>
                    </div>
                  </div>
                  <span className={`self-start rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyle(appointment.status)}`}>
                    {appointment.status.replaceAll('_', ' ')}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Clock3 aria-hidden="true" size={14} /> Appointment time
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{formatAppointmentTime(startTime)}</dd>
                  </div>
                  {provider?.address?.city && (
                    <div>
                      <dt className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <MapPin aria-hidden="true" size={14} /> Location
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-800">
                        {[provider.address.city, provider.address.state].filter(Boolean).join(', ')}
                      </dd>
                    </div>
                  )}
                  {typeof appointment.bookingDetails?.consultationFee === 'number' && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consultation fee</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-800">{appointment.bookingDetails.consultationFee}</dd>
                    </div>
                  )}
                  {appointment.reasonForVisit && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason for visit</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{appointment.reasonForVisit}</dd>
                    </div>
                  )}
                </dl>
                {canCancel && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <button
                      className="btn-secondary border-rose-200 text-rose-800 hover:border-rose-300 hover:bg-rose-50"
                      disabled={Boolean(cancellingId)}
                      onClick={() => cancelAppointment(appointment)}
                      type="button"
                    >
                      {cancellingId === appointment._id ? 'Cancelling…' : 'Cancel appointment'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {!isLoading && !error && pagination?.total > 0 && totalPages > 1 && (
        <nav aria-label="Appointment history pages" className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={16} /> Previous
          </button>
          <p className="text-sm text-slate-600" aria-live="polite">
            Page {pagination.page} of {totalPages} · {pagination.total} appointments
          </p>
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            type="button"
          >
            Next <ArrowRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
