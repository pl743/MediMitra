import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { useAuth } from '../context/useAuth.js';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

function formatTime(value) {
  if (!value) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export function MyWaitlistPage() {
  const { setUser } = useAuth();
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    withAuthRefresh(() => api.get('/waitlists/my'))
      .then(({ data }) => {
        if (active) {
          setEntries(data.data.waitlist);
          setError('');
        }
      })
      .catch((requestError) => {
        if (active) {
          if (requestError.response?.status === 401) setUser(null);
          setError(getApiErrorMessage(requestError, 'Your waitlist entries could not be loaded.'));
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey, setUser]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function performAction(entry, action) {
    if (busyId) return;
    setBusyId(entry._id);
    setActionError('');
    setNotice('');
    try {
      if (action === 'accept') {
        await withAuthRefresh(() => api.patch(`/waitlists/${entry._id}/accept`));
        setNotice('The server accepted the offer and created your appointment.');
      } else {
        await withAuthRefresh(() => api.patch(`/waitlists/${entry._id}/cancel`));
        setNotice('Your waitlist entry was cancelled.');
      }
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      if (requestError.response?.status === 401) setUser(null);
      setActionError(getApiErrorMessage(requestError, 'The waitlist action could not be completed.'));
      if (requestError.response?.status === 409) setReloadKey((key) => key + 1);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Review your active requests and any time-limited slot offers. An appointment is created only after you accept an offer."
        eyebrow="Appointments"
        icon={CalendarClock}
        title="My waitlist"
      />
      {actionError && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{actionError}</p>}
      {notice && <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950" role="status">{notice}</p>}
      {loading ? <LoadingState label="Loading your waitlist" /> : error ? (
        <ErrorState message={error} onRetry={() => { setError(''); setLoading(true); setReloadKey((key) => key + 1); }} />
      ) : entries.length === 0 ? (
        <EmptyState title="No waitlist entries" message="Open a doctor profile and join a date range to request a slot if none suit you." />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const doctor = entry.doctorId;
            const offered = entry.status === 'offered' && new Date(entry.offerExpiresAt).getTime() > now;
            return (
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" key={entry._id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-bold text-ink">
                      {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Doctor'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Preferred dates: {formatTime(entry.preferredDateStart)} – {formatTime(entry.preferredDateEnd)}
                    </p>
                    {entry.offeredSlotId && (
                      <p className="mt-2 text-sm font-semibold text-teal-900">
                        Available slot: {formatTime(entry.offeredSlotId.startTime)}
                      </p>
                    )}
                    {offered && <p className="mt-1 text-sm text-amber-800">Offer expires {formatTime(entry.offerExpiresAt)}.</p>}
                    {entry.acceptedAppointmentId && <p className="mt-2 text-sm text-emerald-800">Appointment status: {entry.acceptedAppointmentId.status}</p>}
                  </div>
                  <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">{entry.status}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {offered && (
                    <button className="btn-primary" disabled={Boolean(busyId)} onClick={() => performAction(entry, 'accept')} type="button">
                      <CheckCircle2 aria-hidden="true" size={16} /> {busyId === entry._id ? 'Processing…' : 'Accept offer'}
                    </button>
                  )}
                  {['waiting', 'offered'].includes(entry.status) && (
                    <button className="btn-secondary border-rose-200 text-rose-800" disabled={Boolean(busyId)} onClick={() => performAction(entry, 'cancel')} type="button">
                      Cancel waitlist entry
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
