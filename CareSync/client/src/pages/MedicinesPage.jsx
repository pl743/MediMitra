import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Pill } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader, SearchBox } from '../components/SearchPageHeader.jsx';
import { useAuth } from '../context/useAuth.js';
import { api, getApiErrorMessage, withAuthRefresh } from '../services/api.js';

const forms = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other'];

function formattedDate(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function ReservationOffer({ offer, user, onReserve, isSubmitting }) {
  const [quantity, setQuantity] = useState(1);
  const isStale = offer.isStale || offer.stockStatus === 'confirmation_needed';
  const available = !isStale && offer.availableQuantity > 0;
  const pharmacy = offer.pharmacyId;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-semibold text-slate-900">{pharmacy?.name || 'Pharmacy'}</h4>
          {pharmacy?.address && (
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-slate-600">
              <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
              {[pharmacy.address.city, pharmacy.address.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <p className="font-semibold text-slate-800">{offer.price}</p>
      </div>
      {isStale ? (
        <p className="mt-3 text-sm font-medium text-amber-900">
          Stock needs pharmacy confirmation. Last confirmed {formattedDate(offer.confirmedAt)}.
        </p>
      ) : (
        <p className={`mt-3 text-sm font-medium ${available ? 'text-emerald-800' : 'text-slate-600'}`}>
          {available ? `${offer.availableQuantity} available` : 'Currently out of stock'}
          {offer.confirmedAt && ` · confirmed ${formattedDate(offer.confirmedAt)}`}
        </p>
      )}
      {available && (
        user?.role === 'patient' ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onReserve(offer._id, quantity);
            }}
          >
            <label className="text-xs font-semibold text-slate-700">
              Quantity
              <input
                className="form-control mt-1 min-h-10 w-24"
                disabled={isSubmitting}
                max={Math.min(offer.availableQuantity, 1000)}
                min="1"
                onChange={(event) => setQuantity(Number(event.target.value))}
                required
                type="number"
                value={quantity}
              />
            </label>
            <button className="btn-primary min-h-10 px-4 text-sm" disabled={isSubmitting || !quantity || quantity > offer.availableQuantity} type="submit">
              {isSubmitting ? 'Submitting…' : 'Request reservation'}
            </button>
          </form>
        ) : user ? (
          <p className="mt-3 text-xs leading-5 text-slate-600">Reservations are available to patient accounts.</p>
        ) : (
          <p className="mt-3 text-sm"><Link className="quiet-link" to="/login">Sign in</Link> with a patient account to request a reservation.</p>
        )
      )}
    </div>
  );
}

export function MedicinesPage() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState(null);
  const [offersResult, setOffersResult] = useState(null);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [category, setCategory] = useState('');
  const [appliedCategory, setAppliedCategory] = useState('');
  const [strength, setStrength] = useState('');
  const [appliedStrength, setAppliedStrength] = useState('');
  const [form, setForm] = useState('');
  const [appliedForm, setAppliedForm] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [reservationError, setReservationError] = useState('');
  const [reservingId, setReservingId] = useState('');
  const [reservationSuccess, setReservationSuccess] = useState('');

  const catalogKey = `${appliedQuery}:${appliedCategory}:${appliedStrength}:${appliedForm}:${page}:${reloadKey}`;
  const catalogLoading = medicines?.key !== catalogKey;
  const medicineList = catalogLoading ? [] : medicines.items;
  const catalogError = catalogLoading ? '' : medicines.error;
  const medicineIds = medicineList.map((medicine) => medicine._id).join(',');
  const offerKey = catalogLoading ? '' : `${catalogKey}:${medicineIds}`;
  const offersLoading = !offerKey || offersResult?.key !== offerKey;
  const offers = offersLoading ? [] : offersResult.items;
  const offersError = offersLoading ? '' : offersResult.error;

  useEffect(() => {
    let active = true;
    api.get('/medicines/search', {
      params: {
        q: appliedQuery || undefined,
        category: appliedCategory || undefined,
        strength: appliedStrength || undefined,
        form: appliedForm || undefined,
        page,
        limit: 12,
      },
    })
      .then(({ data }) => {
        if (active) setMedicines({
          key: catalogKey,
          items: data.data.medicines,
          pagination: data.data.pagination,
          error: '',
        });
      })
      .catch((error) => {
        if (active) setMedicines({
          key: catalogKey,
          items: [],
          pagination: null,
          error: getApiErrorMessage(error, 'The medicine catalog could not be loaded.'),
        });
      });
    return () => {
      active = false;
    };
  }, [appliedQuery, appliedCategory, appliedStrength, appliedForm, page, reloadKey, catalogKey]);

  useEffect(() => {
    if (!offerKey || !medicineIds) return undefined;
    let active = true;
    api.get('/inventory/search', {
      params: { medicineIds, sort: 'price_asc', page: 1, limit: 100 },
    })
      .then(({ data }) => {
        if (active) setOffersResult({ key: offerKey, items: data.data.items, error: '' });
      })
      .catch((error) => {
        if (active) setOffersResult({
          key: offerKey,
          items: [],
          error: getApiErrorMessage(error, 'Pharmacy stock information could not be loaded.'),
        });
      });
    return () => {
      active = false;
    };
  }, [offerKey, medicineIds]);

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(query.trim());
    setAppliedCategory(category.trim());
    setAppliedStrength(strength.trim());
    setAppliedForm(form);
  }

  async function reserveStock(inventoryId, quantity) {
    setReservationError('');
    setReservationSuccess('');
    setReservingId(inventoryId);
    try {
      const { data } = await withAuthRefresh(() => api.post('/reservations', { inventoryId, quantity }));
      setReservationSuccess(`Reservation request submitted. Status: ${data.data.reservation.status}. Pharmacy confirmation is required.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null);
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }
      setReservationError(getApiErrorMessage(error, 'We could not submit this reservation. Refresh stock and try again.'));
      setReloadKey((value) => value + 1);
    } finally {
      setReservingId('');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Compare catalog medicines with pharmacy-reported stock. Stale stock must be reconfirmed before it can be reserved."
        eyebrow="Medicine catalog"
        icon={Pill}
        title="Search medicines"
      />
      {user?.role === 'patient' && (
        <Link className="btn-secondary mb-5" to="/reservations/my">My reservations <ArrowRight aria-hidden="true" size={15} /></Link>
      )}
      <section aria-label="Search medicines" className="card-shadow rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <SearchBox
              buttonLabel="Search medicines"
              label="Search by brand, generic name, or manufacturer"
              onChange={(event) => setQuery(event.target.value)}
              onSubmit={submitSearch}
              placeholder="Brand, generic name, or manufacturer"
              value={query}
            />
          </div>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="medicine-category">
            Category
            <input className="form-control mt-1.5 min-h-12" id="medicine-category" onChange={(event) => setCategory(event.target.value)} value={category} />
          </label>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="medicine-strength">
            Strength
            <input className="form-control mt-1.5 min-h-12" id="medicine-strength" onChange={(event) => setStrength(event.target.value)} placeholder="e.g. 500 mg" value={strength} />
          </label>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="medicine-form">
            Dosage form
            <select className="form-control mt-1.5 min-h-12" id="medicine-form" onChange={(event) => setForm(event.target.value)} value={form}>
              <option value="">All forms</option>
              {forms.map((item) => <option className="capitalize" key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn-secondary min-h-12" onClick={() => {
              setQuery('');
              setCategory('');
              setStrength('');
              setForm('');
              setAppliedQuery('');
              setAppliedCategory('');
              setAppliedStrength('');
              setAppliedForm('');
              setPage(1);
            }} type="button">Clear filters</button>
          </div>
        </div>
      </section>

      <div className="mt-7 space-y-4">
        {reservationError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{reservationError}</p>}
        {reservationSuccess && <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950" role="status">{reservationSuccess} <Link className="quiet-link ml-2" to="/reservations/my">View reservations</Link></p>}
        {catalogLoading ? (
          <LoadingState label="Searching medicine catalog" />
        ) : catalogError ? (
          <ErrorState message={catalogError} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : medicineList.length === 0 ? (
          <EmptyState title="No medicines found" message="Try another name, category, strength, or dosage form." />
        ) : (
          <>
            <p aria-live="polite" className="text-sm text-slate-600">
              Showing {(page - 1) * medicines.pagination.limit + 1}–{Math.min(page * medicines.pagination.limit, medicines.pagination.total)} of {medicines.pagination.total} catalog medicines
            </p>
            {offersError && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">{offersError} Availability requires confirmation.</p>}
            <div className="grid gap-4 xl:grid-cols-2">
              {medicineList.map((medicine) => {
                const medicineOffers = offers.filter((offer) => offer.medicineId?._id === medicine._id);
                return (
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={medicine._id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-bold text-ink">{medicine.brandName}</h2>
                        <p className="mt-1 text-sm capitalize text-slate-600">{medicine.genericName}</p>
                      </div>
                      {medicine.requiresPrescription && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Prescription required</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {medicine.strength && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{medicine.strength}</span>}
                      {medicine.form && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">{medicine.form}</span>}
                      {medicine.manufacturer && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{medicine.manufacturer}</span>}
                    </div>
                    <p className="mt-4 text-xs leading-5 text-slate-500">Catalog details do not indicate medical suitability. Follow a qualified clinician’s advice.</p>
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <h3 className="text-sm font-bold text-slate-800">Pharmacy listings</h3>
                      {offersLoading ? (
                        <p className="text-sm text-slate-600">Loading stock information…</p>
                      ) : offersError ? (
                        <p className="text-sm text-amber-900">Stock status needs pharmacy confirmation.</p>
                      ) : medicineOffers.length === 0 ? (
                        <p className="text-sm text-slate-600">No active pharmacy listing found; availability needs confirmation.</p>
                      ) : medicineOffers.map((offer) => (
                        <div className="relative" key={offer._id}>
                          <ReservationOffer
                            offer={offer}
                            user={user}
                            onReserve={reserveStock}
                            isSubmitting={Boolean(reservingId)}
                          />
                          {reservingId === offer._id && <span className="absolute inset-0 rounded-xl bg-white/70 p-4 text-sm font-semibold text-teal-900" role="status">Submitting reservation…</span>}
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            {medicines.pagination.pages > 1 && (
              <nav aria-label="Medicine catalog pages" className="flex items-center justify-between border-t border-slate-200 pt-4">
                <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ArrowLeft aria-hidden="true" size={16} /> Previous</button>
                <p aria-live="polite" className="text-sm text-slate-600">Page {page} of {medicines.pagination.pages}</p>
                <button className="btn-secondary" disabled={page >= medicines.pagination.pages} onClick={() => setPage((value) => value + 1)} type="button">Next <ArrowRight aria-hidden="true" size={16} /></button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
