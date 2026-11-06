import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin, Microscope } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { useAuth } from '../context/useAuth.js';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

function formatScheduledAt(value) {
  if (!value) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function statusStyle(status) {
  if (status === 'report_ready') return 'bg-emerald-50 text-emerald-800';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-700';
  if (status === 'confirmed') return 'bg-blue-50 text-blue-800';
  return 'bg-amber-50 text-amber-900';
}

export function MyLabBookingsPage() {
  const { setUser } = useAuth();
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [cancellingId, setCancellingId] = useState('');
  const [actionError, setActionError] = useState('');
  const requestKey = `${page}:${reloadKey}`;
  const loading = result?.requestKey !== requestKey;
  const bookings = loading ? [] : result.bookings;
  const error = loading ? '' : result.error;
  const pagination = loading ? null : result.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;

  useEffect(() => {
    let active = true;
    withAuthRefresh(() => api.get('/lab-bookings/my', { params: { page, limit: 10 } }))
      .then(({ data }) => {
        if (active) setResult({
          requestKey,
          bookings: data.data.bookings,
          pagination: data.data.pagination,
          error: '',
        });
      })
      .catch((error) => {
        if (active) {
          if (error.response?.status === 401) setUser(null);
          setResult({
            requestKey,
            bookings: [],
            pagination: null,
            error: getApiErrorMessage(error, 'Your lab booking requests could not be loaded.'),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [page, reloadKey, requestKey, setUser]);

  async function cancelBooking(booking) {
    if (booking.status !== 'requested' || cancellingId) return;
    if (!window.confirm('Cancel this lab booking request?')) return;

    setCancellingId(booking._id);
    setActionError('');
    try {
      await withAuthRefresh(() => api.patch(`/lab-bookings/${booking._id}/cancel`, {}));
      setReloadKey((value) => value + 1);
    } catch (error) {
      if (error.response?.status === 401) setUser(null);
      setActionError(getApiErrorMessage(error, 'The booking could not be cancelled. Refresh and check its status.'));
    } finally {
      setCancellingId('');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Review requests and booking status returned by the laboratory. Only your patient account can access this list."
        eyebrow="Your diagnostic care"
        icon={Microscope}
        title="My lab bookings"
      />
      {actionError && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{actionError}</p>}
      {loading ? (
        <LoadingState label="Loading your lab bookings" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : bookings.length === 0 ? (
        <EmptyState title="No lab booking requests yet" message="Booking requests you submit will appear here." />
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const lab = booking.labId;
            const test = booking.testId;
            return (
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" key={booking._id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eff2fb] text-indigo-800"><Microscope aria-hidden="true" size={22} /></span>
                    <div>
                      <h2 className="font-bold text-ink">{test?.name || booking.bookingDetails?.testName || 'Diagnostic test'}</h2>
                      <p className="mt-1 text-sm text-slate-600">{lab?.name || booking.bookingDetails?.labName || 'Laboratory'}</p>
                    </div>
                  </div>
                  <span className={`self-start rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyle(booking.status)}`}>
                    {booking.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Clock3 aria-hidden="true" size={14} /> Requested time</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{formatScheduledAt(booking.scheduledAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collection method</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{booking.collectionType === 'home_collection' ? 'Home collection request' : 'Visit laboratory'}</dd>
                  </div>
                  {(lab?.address?.city || booking.bookingDetails?.collectionAddress) && (
                    <div>
                      <dt className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><MapPin aria-hidden="true" size={14} /> Location</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-800">
                        {booking.bookingDetails?.collectionAddress || [lab.address.city, lab.address.state].filter(Boolean).join(', ')}
                      </dd>
                    </div>
                  )}
                  {booking.createdAt && (
                    <div>
                      <dt className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarDays aria-hidden="true" size={14} /> Requested on</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-800">{formatScheduledAt(booking.createdAt)}</dd>
                    </div>
                  )}
                </dl>
                {booking.status === 'requested' && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <button
                      className="btn-secondary border-rose-200 text-rose-800 hover:border-rose-300 hover:bg-rose-50"
                      disabled={Boolean(cancellingId)}
                      onClick={() => cancelBooking(booking)}
                      type="button"
                    >
                      {cancellingId === booking._id ? 'Cancelling…' : 'Cancel request'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {!loading && !error && pagination?.total > 0 && totalPages > 1 && (
        <nav aria-label="Lab booking pages" className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button">
            <ArrowLeft aria-hidden="true" size={16} /> Previous
          </button>
          <p aria-live="polite" className="text-sm text-slate-600">Page {pagination.page} of {totalPages} · {pagination.total} requests</p>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button">
            Next <ArrowRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
