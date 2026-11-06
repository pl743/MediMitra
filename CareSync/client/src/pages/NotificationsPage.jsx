import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { useAuth } from '../context/useAuth.js';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

function notificationLink(notification) {
  if (
    notification.relatedId &&
    (notification.relatedModel === 'Appointment' || notification.relatedModel === 'LabBooking')
  ) {
    const refId = encodeURIComponent(notification.relatedId);
    return `/care-journey?refModel=${notification.relatedModel}&refId=${refId}`;
  }
  if (notification.relatedModel === 'Reservation') return '/reservations/my';
  if (notification.relatedModel === 'Waitlist') return '/waitlist';
  if (notification.relatedModel === 'CareJourney') return '/care-journey';
  return null;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function NotificationsPage() {
  const { setUser } = useAuth();
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingId, setSavingId] = useState('');
  const [actionError, setActionError] = useState('');
  const requestKey = `${page}:${reloadKey}`;
  const loading = result?.requestKey !== requestKey;
  const notifications = loading ? [] : result.notifications;
  const unreadCount = loading ? 0 : result.unreadCount;
  const pagination = loading ? null : result.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;

  useEffect(() => {
    let active = true;
    withAuthRefresh(() => api.get('/notifications', { params: { page, limit: 20 } }))
      .then(({ data }) => {
        if (active) setResult({
          requestKey,
          notifications: data.data.notifications,
          unreadCount: data.data.unreadCount,
          pagination: data.data.pagination,
          error: '',
        });
      })
      .catch((requestError) => {
        if (active) {
          if (requestError.response?.status === 401) setUser(null);
          setResult({
            requestKey,
            notifications: [],
            unreadCount: 0,
            pagination: null,
            error: getApiErrorMessage(requestError, 'Notifications could not be loaded.'),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [page, reloadKey, requestKey, setUser]);

  async function markAsRead(notification) {
    if (notification.isRead || savingId) return;
    setSavingId(notification._id);
    setActionError('');
    try {
      await withAuthRefresh(() => api.patch(`/notifications/${notification._id}/read`));
      setResult((current) => current?.requestKey === requestKey
        ? {
          ...current,
          notifications: current.notifications.map((item) => (
            item._id === notification._id ? { ...item, isRead: true } : item
          )),
          unreadCount: Math.max(0, current.unreadCount - 1),
        }
        : current);
    } catch (requestError) {
      if (requestError.response?.status === 401) setUser(null);
      setActionError(getApiErrorMessage(requestError, 'This notification could not be marked as read.'));
    } finally {
      setSavingId('');
    }
  }

  async function markAllAsRead() {
    if (!unreadCount || savingId) return;
    setSavingId('all');
    setActionError('');
    try {
      await withAuthRefresh(() => api.patch('/notifications/read-all'));
      setResult((current) => current?.requestKey === requestKey
        ? {
          ...current,
          notifications: current.notifications.map((notification) => ({ ...notification, isRead: true })),
          unreadCount: 0,
        }
        : current);
    } catch (requestError) {
      if (requestError.response?.status === 401) setUser(null);
      setActionError(getApiErrorMessage(requestError, 'Notifications could not be marked as read.'));
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="In-app updates for supported appointment and lab booking events. No email or SMS delivery is configured."
        eyebrow="Your updates"
        icon={Bell}
        title="Notifications"
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-semibold text-slate-700">
          {unreadCount} unread
        </p>
        <button className="btn-secondary" disabled={!unreadCount || Boolean(savingId)} onClick={markAllAsRead} type="button">
          <CheckCheck aria-hidden="true" size={16} />
          {savingId === 'all' ? 'Updating…' : 'Mark all as read'}
        </button>
      </div>
      {actionError && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{actionError}</p>}
      {loading ? (
        <LoadingState label="Loading notifications" />
      ) : result.error ? (
        <ErrorState message={result.error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : notifications.length === 0 ? (
        <EmptyState title="You’re all caught up" message="Supported appointment and lab booking updates will appear here." />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const href = notificationLink(notification);
            return (
              <article
                className={`rounded-2xl border p-5 shadow-sm ${notification.isRead ? 'border-slate-200 bg-white' : 'border-teal-200 bg-teal-50/50'}`}
                key={notification._id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    {!notification.isRead && <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-700" />}
                    <div>
                      <h2 className="font-semibold text-ink">{notification.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{notification.message}</p>
                      <time className="mt-2 block text-xs text-slate-500" dateTime={notification.createdAt}>
                        {formatDate(notification.createdAt)}
                      </time>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-3 sm:justify-end">
                    {!notification.isRead && (
                      <button
                        className="quiet-link text-sm"
                        disabled={Boolean(savingId)}
                        onClick={() => markAsRead(notification)}
                        type="button"
                      >
                        {savingId === notification._id ? 'Updating…' : 'Mark as read'}
                      </button>
                    )}
                    {href && (
                      <Link
                        className="quiet-link text-sm"
                        onClick={() => markAsRead(notification)}
                        to={href}
                      >
                        View related item
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!loading && !result.error && pagination?.total > 0 && totalPages > 1 && (
        <nav aria-label="Notification pages" className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button">
            <ArrowLeft aria-hidden="true" size={16} /> Previous
          </button>
          <p aria-live="polite" className="text-sm text-slate-600">Page {pagination.page} of {totalPages}</p>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button">
            Next <ArrowRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
