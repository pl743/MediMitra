import { useEffect, useState } from 'react';
import { AlertTriangle, History, PackageCheck, Plus, RefreshCw } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

function stockStatus(item) {
  if (item.isStale) return { text: 'Needs confirmation', style: 'bg-amber-50 text-amber-900' };
  if (item.availableQuantity <= 0) return { text: 'Out of stock', style: 'bg-slate-100 text-slate-700' };
  if (Number.isFinite(item.lowStockThreshold) && item.availableQuantity <= item.lowStockThreshold) {
    return { text: 'Low stock', style: 'bg-orange-50 text-orange-900' };
  }
  return { text: 'In stock', style: 'bg-emerald-50 text-emerald-900' };
}

export function PharmacyInventoryPage() {
  const [inventoryResult, setInventoryResult] = useState(null);
  const [medicineResult, setMedicineResult] = useState(null);
  const [reservationResult, setReservationResult] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [appliedInventoryQuery, setAppliedInventoryQuery] = useState('');
  const [savingId, setSavingId] = useState('');
  const [historyInventoryId, setHistoryInventoryId] = useState('');
  const [historyByInventoryId, setHistoryByInventoryId] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newItem, setNewItem] = useState({ medicineId: '', quantity: '', price: '', lowStockThreshold: '10' });
  const inventoryRequestKey = `${reloadKey}:${appliedInventoryQuery}`;
  const inventoryLoading = inventoryResult?.attempt !== inventoryRequestKey;
  const inventory = inventoryLoading ? [] : inventoryResult.items;
  const inventoryError = inventoryLoading ? '' : inventoryResult.error;
  const medicines = medicineResult?.items || [];
  const medicineError = medicineResult?.error || '';
  const reservationsLoading = reservationResult?.attempt !== reloadKey;
  const reservations = reservationsLoading ? [] : reservationResult.items;
  const reservationsError = reservationsLoading ? '' : reservationResult.error;

  useEffect(() => {
    let active = true;
    withAuthRefresh(() => api.get('/inventory/pharmacy', {
      params: { page: 1, limit: 100, q: appliedInventoryQuery || undefined },
    }))
      .then(({ data }) => {
        if (active) setInventoryResult({ attempt: inventoryRequestKey, items: data.data.items, error: '' });
      })
      .catch((requestError) => {
        if (active) setInventoryResult({
          attempt: inventoryRequestKey,
          items: [],
          error: getApiErrorMessage(requestError, 'Your pharmacy inventory could not be loaded.'),
        });
      });
    return () => {
      active = false;
    };
  }, [reloadKey, appliedInventoryQuery, inventoryRequestKey]);

  useEffect(() => {
    let active = true;
    api.get('/medicines/search', { params: { page: 1, limit: 100 } })
      .then(({ data }) => {
        if (active) setMedicineResult({ items: data.data.medicines, error: '' });
      })
      .catch((requestError) => {
        if (active) setMedicineResult({
          items: [],
          error: getApiErrorMessage(requestError, 'Medicine catalog could not be loaded.'),
        });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    withAuthRefresh(() => api.get('/reservations/pharmacy', {
      params: { page: 1, limit: 50 },
    }))
      .then(({ data }) => {
        if (active) setReservationResult({ attempt: reloadKey, items: data.data.reservations, error: '' });
      })
      .catch((requestError) => {
        if (active) setReservationResult({
          attempt: reloadKey,
          items: [],
          error: getApiErrorMessage(requestError, 'Reservation requests could not be loaded.'),
        });
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function addItem(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await withAuthRefresh(() => api.post('/inventory', {
        medicineId: newItem.medicineId,
        quantity: Number(newItem.quantity),
        price: Number(newItem.price),
        lowStockThreshold: Number(newItem.lowStockThreshold),
      }));
      setSuccess('Inventory item added.');
      setNewItem({ medicineId: '', quantity: '', price: '', lowStockThreshold: '10' });
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Inventory item could not be added.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateItem(item, formData) {
    setSavingId(item._id);
    setError('');
    setSuccess('');
    try {
      await withAuthRefresh(() => api.put(`/inventory/${item._id}`, {
        quantity: Number(formData.get('quantity')),
        price: Number(formData.get('price')),
      }));
      setSuccess(`${item.medicineId?.brandName || 'Inventory item'} updated and stock confirmed.`);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Inventory item could not be updated.'));
    } finally {
      setSavingId('');
    }
  }

  async function respondToReservation(reservationId, status) {
    setSavingId(reservationId);
    setError('');
    setSuccess('');
    try {
      await withAuthRefresh(() => api.patch(`/reservations/${reservationId}/respond`, { status }));
      setSuccess(`Reservation ${status}.`);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Reservation could not be updated.'));
      setReloadKey((value) => value + 1);
    } finally {
      setSavingId('');
    }
  }

  async function loadHistory(inventoryId) {
    setHistoryInventoryId(inventoryId);
    setHistoryByInventoryId((history) => ({
      ...history,
      [inventoryId]: { loading: true, events: [], error: '' },
    }));
    try {
      const { data } = await withAuthRefresh(() => api.get(`/inventory/${inventoryId}/history`, {
        params: { page: 1, limit: 20 },
      }));
      setHistoryByInventoryId((history) => ({
        ...history,
        [inventoryId]: { loading: false, events: data.data.events, error: '' },
      }));
    } catch (requestError) {
      setHistoryByInventoryId((history) => ({
        ...history,
        [inventoryId]: {
          loading: false,
          events: [],
          error: getApiErrorMessage(requestError, 'Inventory history could not be loaded.'),
        },
      }));
    }
  }

  const pendingReservations = reservations.filter((reservation) => reservation.status === 'pending');
  const confirmedReservations = reservations.filter((reservation) => reservation.status === 'confirmed');

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Manage stock for the pharmacy linked to your account. Stock changes are checked against active reservations and recorded in inventory history."
        eyebrow="Pharmacy workspace"
        icon={PackageCheck}
        title="Pharmacy inventory"
      />
      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>}
      {success && <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950" role="status">{success}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-ink">Add medicine stock</h2>
        {medicineError && <p className="mt-3 text-sm text-rose-800" role="alert">{medicineError}</p>}
        <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={addItem}>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Medicine
            <select className="form-control mt-1.5 min-h-12" onChange={(event) => setNewItem((value) => ({ ...value, medicineId: event.target.value }))} required value={newItem.medicineId}>
              <option value="">Select catalog medicine</option>
              {medicines.map((medicine) => <option key={medicine._id} value={medicine._id}>{medicine.brandName} · {medicine.genericName} {medicine.strength || ''}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Total stock
            <input className="form-control mt-1.5 min-h-12" min="0" onChange={(event) => setNewItem((value) => ({ ...value, quantity: event.target.value }))} required type="number" value={newItem.quantity} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Unit price
            <input className="form-control mt-1.5 min-h-12" min="0" onChange={(event) => setNewItem((value) => ({ ...value, price: event.target.value }))} required step="0.01" type="number" value={newItem.price} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Low-stock threshold
            <input className="form-control mt-1.5 min-h-12" min="0" onChange={(event) => setNewItem((value) => ({ ...value, lowStockThreshold: event.target.value }))} type="number" value={newItem.lowStockThreshold} />
          </label>
          <div className="flex items-end sm:col-span-2">
            <button className="btn-primary min-h-12" disabled={submitting || medicines.length === 0} type="submit">
              <Plus aria-hidden="true" size={17} /> {submitting ? 'Adding…' : 'Add stock'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-ink">Your inventory</h2>
          <button className="btn-secondary" onClick={() => setReloadKey((value) => value + 1)} type="button"><RefreshCw aria-hidden="true" size={15} /> Refresh</button>
        </div>
        <form
          className="mb-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedInventoryQuery(inventoryQuery.trim());
          }}
          role="search"
        >
          <label className="sr-only" htmlFor="inventory-search">Search your inventory</label>
          <input
            className="form-control min-h-11 flex-1"
            id="inventory-search"
            onChange={(event) => setInventoryQuery(event.target.value)}
            placeholder="Search medicine name or generic name"
            type="search"
            value={inventoryQuery}
          />
          <button className="btn-secondary" type="submit">Search inventory</button>
        </form>
        {inventoryLoading ? (
          <LoadingState label="Loading pharmacy inventory" />
        ) : inventoryError ? (
          <ErrorState message={inventoryError} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : inventory.length === 0 ? (
          <EmptyState title="No inventory items yet" message="Add an active medicine from the catalog to begin managing stock." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {inventory.map((item) => {
              const status = stockStatus(item);
              return (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item._id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-ink">{item.medicineId?.brandName}</h3>
                      <p className="mt-1 text-sm capitalize text-slate-600">{item.medicineId?.genericName} · {item.medicineId?.strength} · {item.medicineId?.form}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.style}`}>{status.text}</span>
                  </div>
                  {status.text === 'Low stock' && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-orange-900"><AlertTriangle aria-hidden="true" size={14} /> At or below configured threshold of {item.lowStockThreshold}</p>
                  )}
                  {item.isStale && <p className="mt-2 text-sm text-amber-900">Last confirmed: {item.confirmedAt ? new Date(item.confirmedAt).toLocaleString() : 'Not recorded'}</p>}
                  <form
                    className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      updateItem(item, new FormData(event.currentTarget));
                    }}
                  >
                    <label className="text-xs font-semibold text-slate-600">
                      Total quantity
                      <input className="form-control mt-1 min-h-10" defaultValue={item.quantity} min="0" name="quantity" required type="number" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Unit price
                      <input className="form-control mt-1 min-h-10" defaultValue={item.price} min="0" name="price" required step="0.01" type="number" />
                    </label>
                    <button className="btn-secondary self-end" disabled={savingId === item._id} type="submit">{savingId === item._id ? 'Saving…' : 'Save and confirm stock'}</button>
                  </form>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">{item.availableQuantity} available of {item.quantity} ({item.reservedQuantity} reserved)</span>
                    <button
                      className="quiet-link inline-flex items-center gap-1.5 text-sm"
                      onClick={() => {
                        if (historyInventoryId === item._id) setHistoryInventoryId('');
                        else if (historyByInventoryId[item._id]) setHistoryInventoryId(item._id);
                        else loadHistory(item._id);
                      }}
                      type="button"
                    >
                      <History aria-hidden="true" size={14} /> {historyInventoryId === item._id ? 'Hide history' : 'View history'}
                    </button>
                  </div>
                  {historyInventoryId === item._id && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      {historyByInventoryId[item._id]?.loading ? (
                        <LoadingState label="Loading inventory history" />
                      ) : historyByInventoryId[item._id]?.error ? (
                        <div>
                          <p className="text-sm text-rose-800" role="alert">{historyByInventoryId[item._id].error}</p>
                          <button className="quiet-link mt-2 text-sm" onClick={() => loadHistory(item._id)} type="button">Retry</button>
                        </div>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {(historyByInventoryId[item._id]?.events || []).map((entry) => (
                            <li className="flex flex-wrap justify-between gap-2 text-slate-600" key={entry._id}>
                              <span className="capitalize">{entry.type.replace(/_/g, ' ')} · {entry.quantityDelta > 0 ? '+' : ''}{entry.quantityDelta}</span>
                              <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                            </li>
                          ))}
                          {historyByInventoryId[item._id]?.events.length === 0 && (
                            <li className="text-sm text-slate-500">No inventory changes recorded yet.</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold text-ink">Pending reservation requests</h2>
        {reservationsLoading ? (
          <LoadingState label="Loading reservation requests" />
        ) : reservationsError ? (
          <ErrorState message={reservationsError} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : pendingReservations.length === 0 ? (
          <EmptyState title="No pending requests" message="New patient reservation requests will appear here." />
        ) : (
          <div className="space-y-3">
            {pendingReservations.map((reservation) => (
              <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between" key={reservation._id}>
                <div>
                  <h3 className="font-semibold text-ink">{reservation.medicineId?.brandName} · {reservation.quantity} units</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Patient: {reservation.patientId?.firstName} {reservation.patientId?.lastName}
                    {' · '}expires {new Date(reservation.expiresAt).toLocaleString()}
                  </p>
                  {reservation.patientNotes && <p className="mt-1 text-sm text-slate-600">Note: {reservation.patientNotes}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={savingId === reservation._id} onClick={() => respondToReservation(reservation._id, 'confirmed')} type="button">Confirm</button>
                  <button className="btn-secondary border-rose-200 text-rose-800" disabled={savingId === reservation._id} onClick={() => respondToReservation(reservation._id, 'rejected')} type="button">Reject</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {confirmedReservations.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-ink">Confirmed reservations</h2>
          <div className="space-y-3">
            {confirmedReservations.map((reservation) => (
              <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between" key={reservation._id}>
                <div>
                  <h3 className="font-semibold text-ink">{reservation.medicineId?.brandName} · {reservation.quantity} units</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Patient: {reservation.patientId?.firstName} {reservation.patientId?.lastName}
                  </p>
                </div>
                <button className="btn-primary" disabled={savingId === reservation._id} onClick={() => respondToReservation(reservation._id, 'fulfilled')} type="button">
                  {savingId === reservation._id ? 'Updating…' : 'Mark fulfilled'}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
