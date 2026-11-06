import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SearchPageHeader } from '../components/SearchPageHeader.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { api, getApiErrorMessage } from '../services/api.js';

function doctorName(doctor) {
  const { firstName = '', lastName = '' } = doctor.userId || {};
  return `Dr. ${firstName} ${lastName}`.trim();
}

export function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [filters, setFilters] = useState({ q: '', specialty: '', providerName: '', city: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .get('/doctors', { params: { ...appliedFilters, page, limit: 12 } })
      .then(({ data }) => {
        if (active) {
          setDoctors(data.data.doctors);
          setPagination(data.data.pagination);
          setError('');
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            getApiErrorMessage(
              requestError,
              'The doctor directory is not available right now. Check that the backend is running and try again.'
            )
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appliedFilters, page, reloadKey]);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submitSearch(event) {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setPage(1);
    setAppliedFilters(
      Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value.trim()]))
    );
  }

  function retrySearch() {
    setIsLoading(true);
    setError('');
    setReloadKey((key) => key + 1);
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Find a doctor by name, specialty, clinic, or city. Directory results include verified, active providers."
        eyebrow="Care directory"
        icon={Stethoscope}
        title="Find the right doctor"
      />
      <form aria-label="Search doctors" className="card-shadow rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" onSubmit={submitSearch}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: 'q', label: 'Doctor name', placeholder: 'Search doctor name' },
            { name: 'specialty', label: 'Specialty', placeholder: 'e.g. Cardiology' },
            { name: 'providerName', label: 'Clinic or provider', placeholder: 'Provider name' },
            { name: 'city', label: 'City', placeholder: 'City' },
          ].map((field) => (
            <label className="block text-sm font-semibold text-slate-700" htmlFor={`doctor-${field.name}`} key={field.name}>
              {field.label}
              <input
                autoComplete="off"
                className="form-control mt-1.5 min-h-12"
                id={`doctor-${field.name}`}
                name={field.name}
                onChange={updateFilter}
                placeholder={field.placeholder}
                type="search"
                value={filters[field.name]}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary min-h-11 px-5" type="submit">Search doctors</button>
          <button
            className="btn-secondary min-h-11 px-5"
            onClick={() => {
              const cleared = { q: '', specialty: '', providerName: '', city: '' };
              setFilters(cleared);
              setAppliedFilters(cleared);
              setPage(1);
              setIsLoading(true);
              setError('');
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>
      </form>

      <div className="mt-8">
        {isLoading ? (
          <LoadingState label="Loading doctor directory" />
        ) : error ? (
          <ErrorState message={error} onRetry={retrySearch} />
        ) : doctors.length === 0 ? (
          <EmptyState
            message="Try adjusting your filters, or check back when more verified doctor profiles are available."
            title="No doctors found"
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600" aria-live="polite">
              Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total} doctors
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {doctors.map((doctor) => (
                <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-teal-200 hover:shadow-md" key={doctor._id}>
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e8f4f1] text-teal-800">
                      <Stethoscope aria-hidden="true" size={22} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-ink">{doctorName(doctor)}</h2>
                      <p className="mt-1 text-sm font-medium text-teal-800">{doctor.specialty}</p>
                    </div>
                  </div>
                  {doctor.qualifications?.length > 0 && (
                    <p className="mt-4 text-sm leading-6 text-slate-600">{doctor.qualifications.join(' · ')}</p>
                  )}
                  {doctor.providerId?.name && <p className="mt-3 text-sm font-semibold text-slate-700">{doctor.providerId.name}</p>}
                  {doctor.providerId?.address?.city && (
                    <p className="mt-1 text-sm text-slate-500">
                      {[doctor.providerId.address.city, doctor.providerId.address.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {typeof doctor.consultationFee === 'number' && (
                    <p className="mt-4 text-sm text-slate-600">
                      Consultation fee <span className="font-semibold text-ink">{doctor.consultationFee}</span>
                    </p>
                  )}
                  <Link className="quiet-link mt-5 inline-flex items-center gap-2 self-start text-sm" to={`/doctors/${doctor.userId._id}`}>
                    View profile and availability <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </article>
              ))}
            </div>
            {pagination.pages > 1 && (
              <nav aria-label="Doctor directory pages" className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => {
                    setIsLoading(true);
                    setPage((current) => current - 1);
                  }}
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" size={16} /> Previous
                </button>
                <p className="text-sm text-slate-600" aria-live="polite">Page {page} of {pagination.pages}</p>
                <button
                  className="btn-secondary"
                  disabled={page >= pagination.pages}
                  onClick={() => {
                    setIsLoading(true);
                    setPage((current) => current + 1);
                  }}
                  type="button"
                >
                  Next <ArrowRight aria-hidden="true" size={16} />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
