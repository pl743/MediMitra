import { useEffect, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, BadgeCheck, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

const initialData = {
  analytics: null,
  providers: [],
  providerPagination: null,
  users: [],
  userPagination: null,
  logs: [],
};

export function AdminDashboardPage() {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [providerStatus, setProviderStatusFilter] = useState('pending');
  const [providerPage, setProviderPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  useEffect(() => {
    let active = true;
    Promise.all([
      withAuthRefresh(() => api.get('/admin/analytics')),
      withAuthRefresh(() => api.get('/admin/providers', {
        params: { verificationStatus: providerStatus, page: providerPage, limit: 10 },
      })),
      withAuthRefresh(() => api.get('/admin/users', { params: { page: userPage, limit: 10 } })),
      withAuthRefresh(() => api.get('/admin/audit-logs', { params: { page: 1, limit: 10 } })),
    ])
      .then(([analyticsResponse, providersResponse, usersResponse, auditResponse]) => {
        if (active) {
          setData({
            analytics: analyticsResponse.data.data,
            providers: providersResponse.data.data.providers,
            providerPagination: providersResponse.data.data.pagination,
            users: usersResponse.data.data.users,
            userPagination: usersResponse.data.data.pagination,
            logs: auditResponse.data.data.logs,
          });
          setError('');
        }
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, 'The administrator dashboard could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [providerPage, providerStatus, reloadKey, userPage]);

  async function setProviderStatus(provider, status) {
    setBusyId(provider._id);
    setLoading(true);
    setActionError('');
    try {
      await withAuthRefresh(() => api.patch(`/admin/providers/${provider._id}/verification`, { status }));
      setProviderPage(1);
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Provider status could not be updated.'));
      setLoading(false);
    } finally {
      setBusyId('');
    }
  }

  async function setUserStatus(user) {
    setBusyId(user._id);
    setLoading(true);
    setActionError('');
    try {
      await withAuthRefresh(() => api.patch(`/admin/users/${user._id}/status`, { isActive: !user.isActive }));
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'User status could not be updated.'));
      setLoading(false);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Database-backed operational totals, provider reviews, user status, and recent administrative actions."
        eyebrow="Administration"
        icon={ShieldCheck}
        title="Admin dashboard"
      />
      {actionError && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{actionError}</p>}
      {loading ? <LoadingState label="Loading administrator data" /> : error ? (
        <ErrorState message={error} onRetry={() => { setError(''); setLoading(true); setReloadKey((key) => key + 1); }} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Users', data.analytics.users, Users],
              ['Providers', data.analytics.providers, BadgeCheck],
              ['Appointments', data.analytics.appointments, Activity],
              ['Lab bookings', data.analytics.labBookings, Activity],
              ['Reservations', data.analytics.reservations, Activity],
            ].map(([label, count, Icon]) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
                <Icon aria-hidden="true" className="text-teal-800" size={20} />
                <p className="mt-4 text-sm text-slate-600">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{count}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-ink">Provider management</h2>
                <label className="text-sm font-semibold text-slate-700" htmlFor="provider-status-filter">
                  Verification status
                  <select
                    className="form-control mt-1 min-h-10"
                    id="provider-status-filter"
                    onChange={(event) => {
                      setProviderStatusFilter(event.target.value);
                      setProviderPage(1);
                      setLoading(true);
                    }}
                    value={providerStatus}
                  >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
              </div>
              {data.providers.length === 0 ? <p className="mt-4 text-sm text-slate-600">No providers match this verification status.</p> : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {data.providers.map((provider) => (
                    <li className="py-4 first:pt-0 last:pb-0" key={provider._id}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-ink">{provider.name}</p>
                          <p className="text-sm capitalize text-slate-600">
                            {provider.type} · {provider.verificationStatus} · {[provider.address?.city, provider.address?.state].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {provider.verificationStatus !== 'verified' && (
                            <button className="btn-primary px-3 py-2" disabled={Boolean(busyId)} onClick={() => setProviderStatus(provider, 'verified')} type="button">
                              {busyId === provider._id ? 'Saving…' : 'Verify'}
                            </button>
                          )}
                          {provider.verificationStatus !== 'rejected' && (
                            <button className="btn-secondary px-3 py-2" disabled={Boolean(busyId)} onClick={() => setProviderStatus(provider, 'rejected')} type="button">Reject</button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data.providerPagination?.pages > 1 && (
                <nav aria-label="Provider pages" className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <button className="btn-secondary px-3 py-2" disabled={providerPage <= 1} onClick={() => { setProviderPage((page) => page - 1); setLoading(true); }} type="button">
                    <ArrowLeft aria-hidden="true" size={15} /> Previous
                  </button>
                  <span className="text-sm text-slate-600">Page {data.providerPagination.page} of {data.providerPagination.pages}</span>
                  <button className="btn-secondary px-3 py-2" disabled={providerPage >= data.providerPagination.pages} onClick={() => { setProviderPage((page) => page + 1); setLoading(true); }} type="button">
                    Next <ArrowRight aria-hidden="true" size={15} />
                  </button>
                </nav>
              )}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-bold text-ink">Recent administrative activity</h2>
              {data.logs.length === 0 ? <p className="mt-4 text-sm text-slate-600">No administrative activity recorded.</p> : (
                <ul className="mt-4 space-y-3">
                  {data.logs.map((log) => (
                    <li className="border-b border-slate-100 pb-3 last:border-0" key={log._id}>
                      <p className="text-sm font-semibold text-slate-800">{log.action.replaceAll('_', ' ')}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.actorId ? `${log.actorId.firstName} ${log.actorId.lastName}` : 'System'} · {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-ink">User account status</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {data.users.map((user) => (
                <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={user._id}>
                  <div>
                    <p className="font-semibold text-ink">{user.firstName} {user.lastName}</p>
                    <p className="text-sm text-slate-600">{user.email} · {user.role.replaceAll('_', ' ')}</p>
                  </div>
                  <button className="btn-secondary px-3 py-2" disabled={Boolean(busyId)} onClick={() => setUserStatus(user)} type="button">
                    {busyId === user._id ? 'Saving…' : user.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </li>
              ))}
            </ul>
            {data.userPagination?.pages > 1 && (
              <nav aria-label="User pages" className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <button className="btn-secondary px-3 py-2" disabled={userPage <= 1} onClick={() => { setUserPage((page) => page - 1); setLoading(true); }} type="button">
                  <ArrowLeft aria-hidden="true" size={15} /> Previous
                </button>
                <span className="text-sm text-slate-600">Page {data.userPagination.page} of {data.userPagination.pages}</span>
                <button className="btn-secondary px-3 py-2" disabled={userPage >= data.userPagination.pages} onClick={() => { setUserPage((page) => page + 1); setLoading(true); }} type="button">
                  Next <ArrowRight aria-hidden="true" size={15} />
                </button>
              </nav>
            )}
          </section>
          <button className="btn-secondary mt-6" onClick={() => { setLoading(true); setReloadKey((key) => key + 1); }} type="button">
            <RefreshCw aria-hidden="true" size={16} /> Refresh dashboard
          </button>
        </>
      )}
    </div>
  );
}
