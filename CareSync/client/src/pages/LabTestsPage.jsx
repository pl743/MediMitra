import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Microscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { SearchPageHeader, SearchBox } from '../components/SearchPageHeader.jsx';
import { api, getApiErrorMessage } from '../services/api.js';

const categories = ['blood', 'urine', 'imaging', 'pathology', 'cardiology', 'neurology', 'other'];

export function LabTestsPage() {
  const [testName, setTestName] = useState('');
  const [appliedTestName, setAppliedTestName] = useState('');
  const [category, setCategory] = useState('');
  const [appliedCategory, setAppliedCategory] = useState('');
  const [labName, setLabName] = useState('');
  const [city, setCity] = useState('');
  const [appliedLabName, setAppliedLabName] = useState('');
  const [appliedCity, setAppliedCity] = useState('');
  const [testPage, setTestPage] = useState(1);
  const [labPage, setLabPage] = useState(1);
  const [testState, setTestState] = useState(null);
  const [labState, setLabState] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const testRequestKey = `${appliedTestName}:${appliedCategory}:${testPage}:${reloadKey}`;
  const labRequestKey = `${appliedLabName}:${appliedCity}:${labPage}:${reloadKey}`;
  const testLoading = testState?.key !== testRequestKey;
  const labLoading = labState?.key !== labRequestKey;
  const tests = testLoading ? [] : testState.tests;
  const labs = labLoading ? [] : labState.labs;

  useEffect(() => {
    let active = true;
    api.get('/labs/tests', {
      params: {
        name: appliedTestName || undefined,
        category: appliedCategory || undefined,
        page: testPage,
        limit: 12,
      },
    })
      .then(({ data }) => {
        if (active) {
          setTestState({
            key: testRequestKey,
            tests: data.data.tests,
            pagination: data.data.pagination,
            error: '',
          });
        }
      })
      .catch((error) => {
        if (active) {
          setTestState({
            key: testRequestKey,
            tests: [],
            pagination: null,
            error: getApiErrorMessage(error, 'The diagnostic test catalog could not be loaded.'),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [appliedTestName, appliedCategory, testPage, reloadKey, testRequestKey]);

  useEffect(() => {
    let active = true;
    api.get('/labs', {
      params: {
        name: appliedLabName || undefined,
        city: appliedCity || undefined,
        page: labPage,
        limit: 12,
      },
    })
      .then(({ data }) => {
        if (active) {
          setLabState({
            key: labRequestKey,
            labs: data.data.labs,
            pagination: data.data.pagination,
            error: '',
          });
        }
      })
      .catch((error) => {
        if (active) {
          setLabState({
            key: labRequestKey,
            labs: [],
            pagination: null,
            error: getApiErrorMessage(error, 'Verified laboratories could not be loaded.'),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [appliedLabName, appliedCity, labPage, reloadKey, labRequestKey]);

  function submitTestSearch(event) {
    event.preventDefault();
    setAppliedTestName(testName.trim());
    setAppliedCategory(category);
    setTestPage(1);
  }

  function submitLabSearch(event) {
    event.preventDefault();
    setAppliedLabName(labName.trim());
    setAppliedCity(city.trim());
    setLabPage(1);
  }

  function retryCatalog() {
    setReloadKey((key) => key + 1);
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <SearchPageHeader
        description="Explore the active diagnostic catalog and find verified laboratories. A booking is a request that the selected lab must confirm."
        eyebrow="Diagnostic care"
        icon={Microscope}
        title="Labs and diagnostic tests"
      />

      <section aria-labelledby="test-search-title">
        <h2 className="text-xl font-bold text-ink" id="test-search-title">Search the test catalog</h2>
        <div aria-label="Search lab tests" className="card-shadow mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <SearchBox
              buttonLabel="Search tests"
              label="Search lab tests by name"
              onChange={(event) => setTestName(event.target.value)}
              onSubmit={submitTestSearch}
              placeholder="Try a test name"
              value={testName}
            />
            <label className="block text-sm font-semibold text-slate-700" htmlFor="lab-category">
              Category
              <select
                className="form-control mt-1.5 min-h-12"
                id="lab-category"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                <option value="">All categories</option>
                {categories.map((item) => <option className="capitalize" key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6">
          {testLoading ? (
            <LoadingState label="Loading the test catalog" />
          ) : testState.error ? (
            <ErrorState message={testState.error} onRetry={retryCatalog} />
          ) : tests.length === 0 ? (
            <EmptyState title="No diagnostic tests found" message="Try a different search or category." />
          ) : (
            <>
            <p className="mb-4 text-sm text-slate-600" aria-live="polite">
              Showing {(testPage - 1) * testState.pagination.limit + 1}–{Math.min(testPage * testState.pagination.limit, testState.pagination.total)} of {testState.pagination.total} catalog tests
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tests.map((test) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={test._id}>
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eff2fb] text-indigo-800">
                      <Microscope aria-hidden="true" size={21} />
                    </span>
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold capitalize text-teal-900">
                      {test.category}
                    </span>
                  </div>
                  <h3 className="mt-4 font-bold text-ink">{test.name}</h3>
                  {test.description && <p className="mt-2 text-sm leading-6 text-slate-600">{test.description}</p>}
                  {(test.sampleType || test.reportTurnaround) && (
                    <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                      {test.sampleType && <div className="flex justify-between gap-3"><dt className="text-slate-500">Sample</dt><dd className="text-right font-medium text-slate-700">{test.sampleType}</dd></div>}
                      {test.reportTurnaround && <div className="flex justify-between gap-3"><dt className="text-slate-500">Report time</dt><dd className="text-right font-medium text-slate-700">{test.reportTurnaround}</dd></div>}
                    </dl>
                  )}
                  <Link className="quiet-link mt-4 inline-flex items-center gap-2 text-sm" to={`/lab-tests/${test._id}`}>
                    Test details <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </article>
              ))}
            </div>
            {testState.pagination.pages > 1 && (
              <nav aria-label="Diagnostic test catalog pages" className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                <button className="btn-secondary" disabled={testPage <= 1} onClick={() => setTestPage((page) => page - 1)} type="button">
                  <ArrowLeft aria-hidden="true" size={16} /> Previous
                </button>
                <p aria-live="polite" className="text-sm text-slate-600">Page {testPage} of {testState.pagination.pages}</p>
                <button className="btn-secondary" disabled={testPage >= testState.pagination.pages} onClick={() => setTestPage((page) => page + 1)} type="button">
                  Next <ArrowRight aria-hidden="true" size={16} />
                </button>
              </nav>
            )}
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="lab-search-title" className="mt-14">
        <h2 className="text-xl font-bold text-ink" id="lab-search-title">Find a verified laboratory</h2>
        <form aria-label="Search laboratories" className="card-shadow mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-5" onSubmit={submitLabSearch}>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="lab-name">
            Laboratory name
            <input className="form-control mt-1.5 min-h-12" id="lab-name" onChange={(event) => setLabName(event.target.value)} placeholder="Search laboratories" value={labName} />
          </label>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="lab-city">
            City
            <input className="form-control mt-1.5 min-h-12" id="lab-city" onChange={(event) => setCity(event.target.value)} placeholder="City" value={city} />
          </label>
          <div className="sm:col-span-2">
            <button className="btn-primary min-h-11 px-5" type="submit">Search laboratories</button>
          </div>
        </form>
        <div className="mt-6">
          {labLoading ? (
            <LoadingState label="Loading verified laboratories" />
          ) : labState.error ? (
            <ErrorState message={labState.error} onRetry={retryCatalog} />
          ) : labs.length === 0 ? (
            <EmptyState title="No verified laboratories found" message="Try another laboratory name or city." />
          ) : (
            <>
            <p className="mb-4 text-sm text-slate-600" aria-live="polite">
              Showing {(labPage - 1) * labState.pagination.limit + 1}–{Math.min(labPage * labState.pagination.limit, labState.pagination.total)} of {labState.pagination.total} verified labs
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {labs.map((lab) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={lab._id}>
                  <h3 className="font-bold text-ink">{lab.name}</h3>
                  {lab.address && (
                    <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-600">
                      <MapPin aria-hidden="true" className="mt-1 shrink-0" size={15} />
                      {[lab.address.street, lab.address.city, lab.address.state, lab.address.pincode].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {lab.operatingHours && <p className="mt-2 text-sm text-slate-600">Hours: {lab.operatingHours}</p>}
                  <Link className="quiet-link mt-4 inline-flex items-center gap-2 text-sm" to={`/labs/${lab._id}`}>
                    Laboratory details and booking request <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </article>
              ))}
            </div>
            {labState.pagination.pages > 1 && (
              <nav aria-label="Laboratory directory pages" className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                <button className="btn-secondary" disabled={labPage <= 1} onClick={() => setLabPage((page) => page - 1)} type="button">
                  <ArrowLeft aria-hidden="true" size={16} /> Previous
                </button>
                <p aria-live="polite" className="text-sm text-slate-600">Page {labPage} of {labState.pagination.pages}</p>
                <button className="btn-secondary" disabled={labPage >= labState.pagination.pages} onClick={() => setLabPage((page) => page + 1)} type="button">
                  Next <ArrowRight aria-hidden="true" size={16} />
                </button>
              </nav>
            )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
