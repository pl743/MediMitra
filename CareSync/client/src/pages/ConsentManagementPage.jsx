import { useEffect, useState } from 'react';
import { FileHeart, ShieldCheck } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { useAuth } from '../context/useAuth.js';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

function recordLabel(appointment) {
  const doctor = appointment.doctorId;
  const name = doctor ? `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() : 'Doctor';
  const date = appointment.bookingDetails?.slotStartTime
    ? new Date(appointment.bookingDetails.slotStartTime).toLocaleString()
    : 'Date unavailable';
  return `${name} · ${date} · ${appointment.status}`;
}

export function ConsentManagementPage() {
  const { setUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [doctorId, setDoctorId] = useState('');
  const [recordType, setRecordType] = useState('Appointment');
  const [appointmentId, setAppointmentId] = useState('');
  const [reportId, setReportId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      withAuthRefresh(() => api.get('/consents/my')),
      withAuthRefresh(() => api.get('/appointments/my', { params: { page: 1, limit: 100 } })),
      withAuthRefresh(() => api.get('/reports/my')),
      api.get('/doctors', { params: { page: 1, limit: 100 } }),
    ])
      .then(([consentResponse, appointmentResponse, reportResponse, doctorResponse]) => {
        if (active) {
          setData({
            consents: consentResponse.data.data.consents,
            appointments: appointmentResponse.data.data.appointments,
            reports: reportResponse.data.data.reports,
            doctors: doctorResponse.data.data.doctors,
            loadedAt: Date.now(),
          });
          setError('');
        }
      })
      .catch((requestError) => {
        if (active) {
          if (requestError.response?.status === 401) setUser(null);
          setError(getApiErrorMessage(requestError, 'Your consent records could not be loaded.'));
        }
      });
    return () => { active = false; };
  }, [reloadKey, setUser]);

  async function grantConsent(event) {
    event.preventDefault();
    const recordId = recordType === 'Appointment' ? appointmentId : reportId;
    if (!doctorId || !recordId || !expiresAt || busy) return;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await withAuthRefresh(() => api.post('/consents', {
        recipientId: doctorId,
        recordType,
        recordId,
        expiresAt: new Date(expiresAt).toISOString(),
      }));
      setNotice('Access has been granted for the selected appointment record.');
      setDoctorId('');
      setAppointmentId('');
      setReportId('');
      setExpiresAt('');
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      if (requestError.response?.status === 401) setUser(null);
      setActionError(getApiErrorMessage(requestError, 'Consent could not be created.'));
    } finally {
      setBusy(false);
    }
  }

  async function revokeConsent(consent) {
    if (busy) return;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await withAuthRefresh(() => api.patch(`/consents/${consent._id}/revoke`));
      setNotice('Access has been revoked.');
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      if (requestError.response?.status === 401) setUser(null);
      setActionError(getApiErrorMessage(requestError, 'Consent could not be revoked.'));
    } finally {
      setBusy(false);
    }
  }

  const loading = !data && !error;
  const selectedRecordId = recordType === 'Appointment' ? appointmentId : reportId;
  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Choose a specific appointment or report record, a doctor, and an expiry. You can revoke access at any time."
        eyebrow="Your privacy"
        icon={ShieldCheck}
        title="Health record sharing"
      />
      {actionError && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{actionError}</p>}
      {notice && <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950" role="status">{notice}</p>}
      {loading ? <LoadingState label="Loading your record-sharing settings" /> : error ? (
        <ErrorState message={error} onRetry={() => { setError(''); setData(null); setReloadKey((key) => key + 1); }} />
      ) : (
        <>
          <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" onSubmit={grantConsent}>
            <h2 className="text-lg font-bold text-ink">Grant record access</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Access is limited to one selected record and doctor. Report file upload/download remains unavailable until private storage is configured.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="consent-record-type">
                Record type
                <select
                  className="form-control mt-1.5"
                  id="consent-record-type"
                  onChange={(event) => {
                    setRecordType(event.target.value);
                    setAppointmentId('');
                    setReportId('');
                  }}
                  value={recordType}
                >
                  <option value="Appointment">Appointment</option>
                  <option value="LabReport">Lab report</option>
                </select>
              </label>
              {recordType === 'Appointment' ? (
                <label className="text-sm font-semibold text-slate-700" htmlFor="consent-appointment">
                  Appointment record
                  <select className="form-control mt-1.5" id="consent-appointment" onChange={(event) => setAppointmentId(event.target.value)} value={appointmentId}>
                    <option value="">Choose an appointment</option>
                    {data.appointments.map((appointment) => <option key={appointment._id} value={appointment._id}>{recordLabel(appointment)}</option>)}
                  </select>
                </label>
              ) : (
                <label className="text-sm font-semibold text-slate-700" htmlFor="consent-report">
                  Lab report
                  <select className="form-control mt-1.5" id="consent-report" onChange={(event) => setReportId(event.target.value)} value={reportId}>
                    <option value="">Choose a report</option>
                    {data.reports.map((report) => (
                      <option key={report._id} value={report._id}>
                        {report.originalFilename || report.summary || 'Lab report'} · {new Date(report.uploadedAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-sm font-semibold text-slate-700" htmlFor="consent-doctor">
                Doctor recipient
                <select className="form-control mt-1.5" id="consent-doctor" onChange={(event) => setDoctorId(event.target.value)} value={doctorId}>
                  <option value="">Choose a doctor</option>
                  {data.doctors.map((doctor) => (
                    <option key={doctor.userId?._id} value={doctor.userId?._id}>
                      Dr. {doctor.userId?.firstName} {doctor.userId?.lastName} · {doctor.specialty}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700" htmlFor="consent-expiry">
                Access expires
                <input className="form-control mt-1.5" id="consent-expiry" onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} />
              </label>
            </div>
            <button className="btn-primary mt-5" disabled={busy || !doctorId || !selectedRecordId || !expiresAt} type="submit">
              <FileHeart aria-hidden="true" size={16} /> {busy ? 'Saving…' : 'Grant access'}
            </button>
          </form>

          <section className="mt-8">
            <h2 className="text-lg font-bold text-ink">Access you have granted</h2>
            {data.consents.length === 0 ? (
              <EmptyState title="No shared records" message="Any record-specific consent you create will be listed here." />
            ) : (
              <div className="mt-4 space-y-3">
                {data.consents.map((consent) => {
                  const active = !consent.isRevoked && new Date(consent.expiresAt).getTime() > data.loadedAt;
                  return (
                    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between" key={consent._id}>
                      <div>
                        <p className="font-semibold text-ink">
                          {consent.recordType === 'Appointment' ? 'Appointment record' : 'Lab report'}
                          {' · '}Dr. {consent.recipientId?.firstName} {consent.recipientId?.lastName}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">Expires {new Date(consent.expiresAt).toLocaleString()}</p>
                        <p className={`mt-1 text-xs font-semibold ${active ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {active ? 'Active' : consent.isRevoked ? 'Revoked' : 'Expired'}
                        </p>
                      </div>
                      {active && <button className="btn-secondary border-rose-200 text-rose-800" disabled={busy} onClick={() => revokeConsent(consent)} type="button">Revoke access</button>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
