import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, PackageCheck } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { useAuth } from '../context/useAuth.js';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

function formatDate(value) {
  if (!value) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function reservationStatusStyle(status) {
  if (status === 'confirmed') return 'bg-blue-50 text-blue-800';
  if (status === 'fulfilled') return 'bg-emerald-50 text-emerald-800';
  if (['rejected', 'cancelled', 'expired'].includes(status)) return 'bg-slate-100 text-slate-700';
  return 'bg-amber-50 text-amber-900';
}

export function MyReservationsPage() {
  const { setUser } = useAuth();
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingId, setSavingId] = useState('');
  const [actionError, setActionError] = useState('');
  const requestKey = `${page}:${reloadKey}`;
  const loading = result?.key !== requestKey;
  const reservations = loading ? [] : result.reservations;
  const error = loading ? '' : result.error;
  const pagination = loading ? null : result.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;

  useEffect(() => {
    let active = true;
    withAuthRefresh(() => api.get('/reservations/my', { params: { page, limit: 10 } }))
      .then(({ data }) => {
        if (active) setResult({
          key: requestKey,
          reservations: data.data.reservations,
          pagination: data.data.pagination,
          error: '',
        });
      })
      .catch((error) => {
        if (active) {
          if (error.response?.status === 401) setUser(null);
          setResult({
            key: requestKey,
            reservations: [],
            pagination: null,
            error: getApiErrorMessage(error, 'Your reservations could not be loaded.'),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [page, reloadKey, requestKey, setUser]);

  async function cancelReservation(reservation) {
    if (reservation.status !== 'pending' || savingId) return;
    if (!window.confirm('Cancel this pending reservation? The held quantity will be released.')) return;
    setSavingId(reservation._id);
    setActionError('');
    try {
      await withAuthRefresh(() => api.patch(`/reservations/${reservation._id}/cancel`, {}));
      setReloadKey((value) => value + 1);
    } catch (error) {
      if (error.response?.status === 401) setUser(null);
      setActionError(getApiErrorMessage(error, 'Reservation cancellation failed. Refresh and check its current status.'));
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Review pharmacy reservation requests and their current status. Reservations do not represent a prescription or medical recommendation."
        eyebrow="Your pharmacy requests"
        icon={PackageCheck}
        title="My reservations"
      />
      {actionError && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{actionError}</p>}
      {loading ? (
        <LoadingState label="Loading your reservations" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : reservations.length === 0 ? (
        <EmptyState title="No reservations yet" message="A successful stock reservation request will appear here." />
      ) : (
        <div className="space-y-4">
          {reservations.map((reservation) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" key={reservation._id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-bold text-ink">{reservation.medicineId?.brandName || reservation.medicineId?.genericName || 'Medicine'}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {reservation.medicineId?.genericName} {reservation.medicineId?.strength} · {reservation.pharmacyId?.name || 'Pharmacy'}
                  </p>
                </div>
                <span className={`self-start rounded-full px-3 py-1 text-xs font-bold capitalize ${reservationStatusStyle(reservation.status)}`}>
                  {reservation.status}
                </span>
              </div>
              <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</dt><dd className="mt-1 font-medium text-slate-800">{reservation.quantity}</dd></div>
                {typeof reservation.priceAtReservation === 'number' && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price at request</dt><dd className="mt-1 font-medium text-slate-800">{reservation.priceAtReservation}</dd></div>}
                <div><dt className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Clock3 aria-hidden="true" size={13} /> Expires</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(reservation.expiresAt)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requested</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(reservation.createdAt)}</dd></div>
              </dl>
              {reservation.patientNotes && <p className="mt-4 text-sm text-slate-600">Note: {reservation.patientNotes}</p>}
              {reservation.rejectionReason && <p className="mt-3 text-sm text-slate-600">Pharmacy response: {reservation.rejectionReason}</p>}
              {reservation.status === 'pending' && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <button className="btn-secondary border-rose-200 text-rose-800" disabled={Boolean(savingId)} onClick={() => cancelReservation(reservation)} type="button">
                    {savingId === reservation._id ? 'Cancelling…' : 'Cancel reservation'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {!loading && !error && pagination?.total > 0 && totalPages > 1 && (
        <nav aria-label="Reservation history pages" className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ArrowLeft aria-hidden="true" size={16} /> Previous</button>
          <p aria-live="polite" className="text-sm text-slate-600">Page {pagination.page} of {totalPages}</p>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button">Next <ArrowRight aria-hidden="true" size={16} /></button>
        </nav>
      )}
    </div>
  );
}
