import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, MapPin, Stethoscope } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

function formatSlotTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export function DoctorProfilePage() {
  const { doctorId } = useParams();
  const { user, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileResult, setProfileResult] = useState(null);
  const [slotsResult, setSlotsResult] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [reason, setReason] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [booking, setBooking] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [waitlistStart, setWaitlistStart] = useState('');
  const [waitlistEnd, setWaitlistEnd] = useState('');
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistNotice, setWaitlistNotice] = useState('');
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [slotsAttempt, setSlotsAttempt] = useState(0);
  const [now, setNow] = useState(0);

  const profileLoading = profileResult?.doctorId !== doctorId || profileResult?.attempt !== profileAttempt;
  const doctor = profileLoading ? null : profileResult.doctor;
  const profileError = profileLoading ? '' : profileResult.error;
  const slotsLoading = slotsResult?.doctorId !== doctorId || slotsResult?.attempt !== slotsAttempt;
  const slots = slotsLoading ? [] : slotsResult.slots;
  const slotsError = slotsLoading ? '' : slotsResult.error;

  useEffect(() => {
    let active = true;
    api
      .get(`/doctors/${doctorId}`)
      .then(({ data }) => {
        if (active) {
          setProfileResult({ doctorId, attempt: profileAttempt, doctor: data.data.doctor, error: '' });
        }
      })
      .catch((requestError) => {
        if (active) {
          setProfileResult({
            doctorId,
            attempt: profileAttempt,
            doctor: null,
            error: getApiErrorMessage(requestError, 'This doctor profile is not available right now.'),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [doctorId, profileAttempt]);

  useEffect(() => {
    let active = true;
    api
      .get(`/doctors/${doctorId}/slots`)
      .then(({ data }) => {
        if (active) {
          setSlotsResult({
            doctorId,
            attempt: slotsAttempt,
            slots: data.data.slots.filter((slot) => new Date(slot.startTime).getTime() > Date.now()),
            error: '',
            checkedAt: Date.now(),
          });
          setSelectedSlotId('');
        }
      })
      .catch((requestError) => {
        if (active) {
          setSlotsResult({
            doctorId,
            attempt: slotsAttempt,
            slots: [],
            error: getApiErrorMessage(requestError, 'Availability could not be loaded. Please try again.'),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [doctorId, slotsAttempt]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function submitBooking(event) {
    event.preventDefault();
    if (!selectedSlotId || isBooking) return;

    const chosenSlot = slots.find((slot) => slot._id === selectedSlotId);
    if (!chosenSlot || new Date(chosenSlot.startTime).getTime() <= Date.now()) {
      setBookingError('That time has passed or is no longer available. Refresh availability and choose another slot.');
      setSelectedSlotId('');
      setSlotsAttempt((attempt) => attempt + 1);
      return;
    }

    setIsBooking(true);
    setBookingError('');
    setBooking(null);
    try {
      const { data } = await withAuthRefresh(() =>
        api.post('/appointments', {
          slotId: selectedSlotId,
          reasonForVisit: reason.trim() || undefined,
        })
      );
      setBooking(data.data.appointment);
      setSelectedSlotId('');
      setSlotsResult(null);
      setSlotsAttempt((attempt) => attempt + 1);
    } catch (requestError) {
      const status = requestError.response?.status;
      if (status === 401) {
        setUser(null);
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }
      setBookingError(
        getApiErrorMessage(
          requestError,
          'We could not confirm the appointment. Check your connection and try again.'
        )
      );
      if (status === 409) {
        setSlotsResult(null);
        setSlotsAttempt((attempt) => attempt + 1);
      }
    } finally {
      setIsBooking(false);
    }
  }

  async function joinWaitlist(event) {
    event.preventDefault();
    if (isJoiningWaitlist || !waitlistStart || !waitlistEnd) return;
    setIsJoiningWaitlist(true);
    setWaitlistError('');
    setWaitlistNotice('');
    try {
      await withAuthRefresh(() => api.post('/waitlists', {
        doctorId,
        preferredDateStart: new Date(waitlistStart).toISOString(),
        preferredDateEnd: new Date(waitlistEnd).toISOString(),
      }));
      setWaitlistNotice('Your waitlist request was saved. You will be notified if a matching slot is offered.');
      setWaitlistStart('');
      setWaitlistEnd('');
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setUser(null);
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }
      setWaitlistError(getApiErrorMessage(requestError, 'Your waitlist request could not be saved.'));
    } finally {
      setIsJoiningWaitlist(false);
    }
  }

  if (profileLoading) {
    return <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8"><LoadingState label="Loading doctor profile" /></div>;
  }

  if (profileError || !doctor) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <ErrorState
          message={profileError || 'This doctor profile is not available.'}
          onRetry={() => setProfileAttempt((attempt) => attempt + 1)}
        />
        <Link className="quiet-link mt-5 inline-flex items-center gap-2 text-sm" to="/doctors">
          <ArrowLeft aria-hidden="true" size={15} /> Back to doctors
        </Link>
      </div>
    );
  }

  const fullName = `Dr. ${doctor.userId?.firstName || ''} ${doctor.userId?.lastName || ''}`.trim();
  const isPatient = user?.role === 'patient';

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <Link className="quiet-link inline-flex items-center gap-2 text-sm" to="/doctors">
        <ArrowLeft aria-hidden="true" size={15} /> Back to doctors
      </Link>

      <section className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e8f4f1] text-teal-800">
              <Stethoscope aria-hidden="true" size={26} />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">Doctor profile</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{fullName}</h1>
              <p className="mt-2 font-semibold text-teal-800">{doctor.specialty}</p>
            </div>
          </div>
          {doctor.qualifications?.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-bold text-ink">Qualifications</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{doctor.qualifications.join(' · ')}</p>
            </div>
          )}
          {doctor.bio && <p className="mt-5 text-sm leading-7 text-slate-600">{doctor.bio}</p>}
          <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            {typeof doctor.consultationFee === 'number' && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consultation fee</dt>
                <dd className="mt-1 font-semibold text-ink">{doctor.consultationFee}</dd>
              </div>
            )}
            {typeof doctor.experience === 'number' && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experience</dt>
                <dd className="mt-1 font-semibold text-ink">{doctor.experience} years</dd>
              </div>
            )}
            {doctor.providerId?.name && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider</dt>
                <dd className="mt-1 font-semibold text-ink">{doctor.providerId.name}</dd>
                {doctor.providerId.address?.city && (
                  <dd className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin aria-hidden="true" size={14} />
                    {[doctor.providerId.address.city, doctor.providerId.address.state].filter(Boolean).join(', ')}
                  </dd>
                )}
              </div>
            )}
            {doctor.languages?.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Languages</dt>
                <dd className="mt-1 text-sm text-slate-700">{doctor.languages.join(', ')}</dd>
              </div>
            )}
          </dl>
        </article>

        <section aria-labelledby="availability-heading" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
              <CalendarDays aria-hidden="true" size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink" id="availability-heading">Available appointments</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Open times for the next seven days. Times are shown in your local timezone.</p>
            </div>
          </div>

          <div className="mt-5">
            {slotsLoading ? (
              <LoadingState label="Checking availability" />
            ) : slotsError ? (
              <ErrorState
                message={slotsError}
                onRetry={() => {
                  setSlotsResult(null);
                  setSlotsAttempt((attempt) => attempt + 1);
                }}
              />
            ) : slots.length === 0 ? (
              <EmptyState title="No upcoming times available" message="Please check back later or explore another doctor." />
            ) : (
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-slate-700">Choose an available time</legend>
                <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                  {slots.map((slot) => {
                    const isPast = new Date(slot.startTime).getTime() <= now;
                    return (
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                          selectedSlotId === slot._id
                            ? 'border-teal-700 bg-teal-50 ring-1 ring-teal-700'
                            : 'border-slate-200 hover:border-teal-300'
                        } ${isPast ? 'cursor-not-allowed opacity-50' : ''}`}
                        key={slot._id}
                      >
                        <input
                          checked={selectedSlotId === slot._id}
                          className="h-4 w-4 accent-teal-800"
                          disabled={isPast || !isPatient}
                          name="appointment-slot"
                          onChange={() => {
                            if (new Date(slot.startTime).getTime() <= Date.now()) {
                              setBookingError('That time has passed. Refresh availability and choose another slot.');
                              setSlotsResult(null);
                              setSlotsAttempt((attempt) => attempt + 1);
                              return;
                            }
                            setSelectedSlotId(slot._id);
                            setBooking(null);
                            setBookingError('');
                          }}
                          type="radio"
                          value={slot._id}
                        />
                        <Clock3 aria-hidden="true" className="shrink-0 text-teal-800" size={16} />
                        <span>{formatSlotTime(slot.startTime)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>

          {!slotsLoading && !slotsError && slots.length > 0 && (
            isPatient ? (
              <form className="mt-5 border-t border-slate-100 pt-5" onSubmit={submitBooking}>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="visit-reason">
                  Reason for visit <span className="font-normal text-slate-500">(optional)</span>
                  <textarea
                    className="form-control mt-1.5 min-h-24 resize-y"
                    id="visit-reason"
                    maxLength={500}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Share a brief note for the care team"
                    value={reason}
                  />
                </label>
                {bookingError && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{bookingError}</p>}
                <button
                  className="btn-primary mt-4 min-h-12 w-full justify-center"
                  disabled={!selectedSlotId || isBooking}
                  type="submit"
                >
                  {isBooking ? 'Booking appointment…' : 'Book this appointment'}
                </button>
                <p className="mt-2 text-xs leading-5 text-slate-500">Availability is checked again by the server when you book.</p>
              </form>
            ) : user ? (
              <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Appointment booking is available to patient accounts.
              </p>
            ) : (
              <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <Link className="quiet-link" state={{ from: location }} to="/login">Sign in</Link> with a patient account to book an appointment.
              </p>
            )
          )}
          {isPatient && (
            <form className="mt-5 border-t border-slate-100 pt-5" onSubmit={joinWaitlist}>
              <h3 className="text-sm font-bold text-ink">Request another date range</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">If no current time works, join one active waitlist for a preferred date range. An offer is not an appointment until you accept it.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="waitlist-start">
                  From
                  <input className="form-control mt-1.5" id="waitlist-start" onChange={(event) => setWaitlistStart(event.target.value)} type="datetime-local" value={waitlistStart} />
                </label>
                <label className="text-sm font-semibold text-slate-700" htmlFor="waitlist-end">
                  Through
                  <input className="form-control mt-1.5" id="waitlist-end" onChange={(event) => setWaitlistEnd(event.target.value)} type="datetime-local" value={waitlistEnd} />
                </label>
              </div>
              {waitlistError && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{waitlistError}</p>}
              {waitlistNotice && <p className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950" role="status">{waitlistNotice}</p>}
              <button className="btn-secondary mt-3 w-full justify-center" disabled={isJoiningWaitlist || !waitlistStart || !waitlistEnd} type="submit">
                {isJoiningWaitlist ? 'Joining waitlist…' : 'Join doctor waitlist'}
              </button>
            </form>
          )}
        </section>
      </section>
      {booking && (
        <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950" role="status">
          <p className="font-semibold">Appointment booked</p>
          <p className="mt-1">
            Your appointment with {booking.bookingDetails?.doctorName || fullName} is confirmed for{' '}
            {formatSlotTime(booking.bookingDetails?.slotStartTime)}.
          </p>
          <Link className="quiet-link mt-2 inline-flex" to="/appointments">View my appointments</Link>
        </div>
      )}
    </div>
  );
}
