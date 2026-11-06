import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, Microscope } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

function localDateTimeMinimum() {
  const localTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

export function LabDetailsPage() {
  const { labId } = useParams();
  const { user, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [labResult, setLabResult] = useState(null);
  const [testsResult, setTestsResult] = useState(null);
  const [testId, setTestId] = useState('');
  const [collectionType, setCollectionType] = useState('lab_visit');
  const [collectionAddress, setCollectionAddress] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [booking, setBooking] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retry, setRetry] = useState(0);
  const labRequestKey = `${labId}:${retry}`;
  const labLoading = labResult?.key !== labRequestKey;
  const testsLoading = testsResult?.key !== retry;

  useEffect(() => {
    let active = true;
    api.get(`/labs/${labId}`)
      .then(({ data }) => {
        if (active) setLabResult({ key: labRequestKey, lab: data.data.lab, error: '' });
      })
      .catch((error) => {
        if (active) setLabResult({
          key: labRequestKey,
          lab: null,
          error: getApiErrorMessage(error, 'Laboratory details could not be loaded.'),
        });
      });
    return () => {
      active = false;
    };
  }, [labId, retry, labRequestKey]);

  useEffect(() => {
    let active = true;
    api.get('/labs/tests', { params: { page: 1, limit: 100 } })
      .then(({ data }) => {
        if (active) setTestsResult({ key: retry, tests: data.data.tests, error: '' });
      })
      .catch((error) => {
        if (active) setTestsResult({
          key: retry,
          tests: [],
          error: getApiErrorMessage(error, 'The active diagnostic test catalog could not be loaded.'),
        });
      });
    return () => {
      active = false;
    };
  }, [retry]);

  async function submitBooking(event) {
    event.preventDefault();
    if (isSubmitting || !testId || !scheduledAt) return;
    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      setBookingError('Choose a future date and time for your request.');
      return;
    }

    setIsSubmitting(true);
    setBookingError('');
    setBooking(null);
    try {
      const { data } = await withAuthRefresh(() => api.post('/lab-bookings', {
        labId,
        testId,
        collectionType,
        scheduledAt: scheduledDate.toISOString(),
        ...(collectionType === 'home_collection' ? { collectionAddress: collectionAddress.trim() } : {}),
      }));
      setBooking(data.data.booking);
      setTestId('');
      setScheduledAt('');
      setCollectionAddress('');
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null);
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }
      setBookingError(getApiErrorMessage(error, 'We could not submit your lab booking request. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (labLoading) {
    return <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8"><LoadingState label="Loading laboratory details" /></div>;
  }
  if (labResult.error) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <ErrorState message={labResult.error} onRetry={() => setRetry((value) => value + 1)} />
        <Link className="quiet-link mt-5 inline-flex items-center gap-2 text-sm" to="/lab-tests"><ArrowLeft aria-hidden="true" size={15} /> Back to labs</Link>
      </div>
    );
  }

  const lab = labResult.lab;
  const isPatient = user?.role === 'patient';
  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <Link className="quiet-link inline-flex items-center gap-2 text-sm" to="/lab-tests"><ArrowLeft aria-hidden="true" size={15} /> Back to tests and labs</Link>
      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-800"><Microscope aria-hidden="true" size={24} /></span>
        <p className="eyebrow mt-5">Verified laboratory</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">{lab.name}</h1>
        {lab.description && <p className="mt-3 leading-7 text-slate-600">{lab.description}</p>}
        {lab.address && (
          <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <MapPin aria-hidden="true" className="mt-1 shrink-0" size={16} />
            {[lab.address.street, lab.address.city, lab.address.state, lab.address.pincode].filter(Boolean).join(', ')}
          </p>
        )}
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-100 pt-4 text-sm">
          {lab.phone && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</dt><dd className="mt-1 font-medium text-slate-800">{lab.phone}</dd></div>}
          {lab.operatingHours && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operating hours</dt><dd className="mt-1 font-medium text-slate-800">{lab.operatingHours}</dd></div>}
        </dl>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-ink">Request a diagnostic test</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The current catalog is platform-wide and does not indicate which tests this lab offers or its available appointment slots. Your preferred test, collection method, and time are sent as a request; the lab must confirm them.
        </p>
        {!isPatient ? (
          <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {user ? 'Booking requests are available to patient accounts.' : <><Link className="quiet-link" state={{ from: location }} to="/login">Sign in</Link> with a patient account to submit a booking request.</>}
          </p>
        ) : testsLoading ? (
          <div className="mt-5"><LoadingState label="Loading active diagnostic tests" /></div>
        ) : testsResult.error ? (
          <div className="mt-5"><ErrorState message={testsResult.error} onRetry={() => setRetry((value) => value + 1)} /></div>
        ) : testsResult.tests.length === 0 ? (
          <div className="mt-5"><EmptyState title="No active tests in the catalog" message="A booking request cannot be submitted until an active test is available." /></div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submitBooking}>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="lab-test">
              Diagnostic test
              <select className="form-control mt-1.5 min-h-12" id="lab-test" onChange={(event) => setTestId(event.target.value)} required value={testId}>
                <option value="">Choose a catalog test</option>
                {testsResult.tests.map((test) => <option key={test._id} value={test._id}>{test.name} · {test.category}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="collection-type">
              Preferred collection method
              <select className="form-control mt-1.5 min-h-12" id="collection-type" onChange={(event) => setCollectionType(event.target.value)} value={collectionType}>
                <option value="lab_visit">Visit the laboratory</option>
                <option value="home_collection">Home collection request</option>
              </select>
            </label>
            {collectionType === 'home_collection' && (
              <label className="block text-sm font-semibold text-slate-700" htmlFor="collection-address">
                Collection address
                <textarea className="form-control mt-1.5 min-h-24 resize-y" id="collection-address" maxLength={500} onChange={(event) => setCollectionAddress(event.target.value)} required value={collectionAddress} />
              </label>
            )}
            <label className="block text-sm font-semibold text-slate-700" htmlFor="scheduled-at">
              Preferred date and time
              <span className="mt-1 block font-normal text-slate-500">This is a requested time, not live availability.</span>
              <input
                className="form-control mt-1.5 min-h-12"
                id="scheduled-at"
                min={localDateTimeMinimum()}
                onChange={(event) => setScheduledAt(event.target.value)}
                required
                type="datetime-local"
                value={scheduledAt}
              />
            </label>
            {bookingError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{bookingError}</p>}
            <button className="btn-primary min-h-12 w-full justify-center sm:w-auto" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Submitting request…' : <><CalendarDays aria-hidden="true" size={17} /> Submit booking request</>}
            </button>
          </form>
        )}
        {booking && (
          <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950" role="status">
            <p className="font-semibold">Booking request submitted</p>
            <p className="mt-1">The request is pending lab confirmation; no availability has been reserved.</p>
            <Link className="quiet-link mt-2 inline-flex" to="/lab-bookings">View my lab bookings</Link>
          </div>
        )}
      </section>
    </div>
  );
}
