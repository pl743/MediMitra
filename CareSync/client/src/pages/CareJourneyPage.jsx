import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Microscope } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { useAuth } from '../context/useAuth.js';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

function eventDate(value) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function eventStatus(event) {
  if (event.status === 'cancelled') return 'bg-slate-100 text-slate-700';
  if (event.status === 'failed') return 'bg-rose-50 text-rose-800';
  if (event.type === 'report_ready' || event.type === 'consultation_completed') {
    return 'bg-emerald-50 text-emerald-800';
  }
  return 'bg-teal-50 text-teal-900';
}

function eventLink(event) {
  if (event.refModel === 'Appointment') return '/appointments';
  if (event.refModel === 'LabBooking') return '/lab-bookings';
  return null;
}

export function CareJourneyPage() {
  const { setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const focusedRefId = searchParams.get('refId');
  const focusedRefModel = searchParams.get('refModel');
  const [result, setResult] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loading = result?.attempt !== reloadKey;
  const events = loading ? [] : result.events;
  const error = loading ? '' : result.error;

  useEffect(() => {
    let active = true;
    withAuthRefresh(() => api.get('/care-journey/my'))
      .then(({ data }) => {
        if (active) setResult({ attempt: reloadKey, events: data.data.events, error: '' });
      })
      .catch((requestError) => {
        if (active) {
          if (requestError.response?.status === 401) setUser(null);
          setResult({
            attempt: reloadKey,
            events: [],
            error: getApiErrorMessage(requestError, 'Your care journey could not be loaded.'),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey, setUser]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="A timeline built from your appointment and diagnostic booking records. Report-ready events appear only when a report is linked to the booking."
        eyebrow="Your care"
        icon={CheckCircle2}
        title="Care journey"
      />
      {loading ? (
        <LoadingState label="Loading your care journey" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : events.length === 0 ? (
        <EmptyState title="Your timeline is empty" message="Appointments and lab booking activity linked to your account will appear here." />
      ) : (
        <ol className="space-y-4">
          {events.map((event) => {
            const href = eventLink(event);
            const Icon = event.refModel === 'LabBooking' ? Microscope : CalendarDays;
            const isFocused = String(event.refId) === focusedRefId && event.refModel === focusedRefModel;
            return (
              <li className={`relative rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${isFocused ? 'border-teal-500 ring-2 ring-teal-100' : 'border-slate-200'}`} key={event.dedupeKey || `${event.type}:${event.refId}:${event.timestamp}`}>
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
                    <Icon aria-hidden="true" size={21} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-semibold text-ink">{event.title}</h2>
                        <time className="mt-1 block text-sm text-slate-600" dateTime={event.timestamp}>
                          {eventDate(event.timestamp)}
                        </time>
                      </div>
                      <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold capitalize ${eventStatus(event)}`}>
                        {event.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {event.description && <p className="mt-3 text-sm leading-6 text-slate-600">{event.description}</p>}
                    {event.status === 'cancelled' && event.refModel === 'Appointment' && (
                      <p className="mt-3 text-sm text-slate-600">Choose another available time when you are ready.</p>
                    )}
                    {event.status === 'cancelled' && event.refModel === 'LabBooking' && (
                      <p className="mt-3 text-sm text-slate-600">You can review diagnostic services and submit a new request if needed.</p>
                    )}
                    {href && (
                      <Link className="quiet-link mt-3 inline-flex items-center gap-1.5 text-sm" to={href}>
                        View related booking <ArrowRight aria-hidden="true" size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
