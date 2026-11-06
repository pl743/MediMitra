import { useEffect, useState } from 'react';
import { ArrowLeft, Microscope } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates.jsx';
import { api, getApiErrorMessage } from '../services/api.js';

export function LabTestDetailPage() {
  const { testId } = useParams();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${testId}:${attempt}`;
  const loading = result?.key !== requestKey;

  useEffect(() => {
    let active = true;
    api.get(`/labs/tests/${testId}`)
      .then(({ data }) => {
        if (active) setResult({ key: requestKey, test: data.data.test, error: '' });
      })
      .catch((error) => {
        if (active) {
          setResult({
            key: requestKey,
            test: null,
            error: getApiErrorMessage(error, 'This diagnostic test could not be loaded.'),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [testId, attempt, requestKey]);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8"><LoadingState label="Loading diagnostic test" /></div>;
  }
  if (result.error) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <ErrorState message={result.error} onRetry={() => setAttempt((value) => value + 1)} />
        <Link className="quiet-link mt-5 inline-flex" to="/lab-tests"><ArrowLeft aria-hidden="true" size={15} /> Back to tests and labs</Link>
      </div>
    );
  }
  if (!result.test) {
    return <EmptyState title="Test not found" message="This test is not currently in the active catalog." />;
  }

  const { test } = result;
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <Link className="quiet-link inline-flex items-center gap-2 text-sm" to="/lab-tests">
        <ArrowLeft aria-hidden="true" size={15} /> Back to tests and labs
      </Link>
      <article className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eff2fb] text-indigo-800">
          <Microscope aria-hidden="true" size={24} />
        </span>
        <p className="eyebrow mt-5">Diagnostic test · {test.category}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">{test.name}</h1>
        {test.description && <p className="mt-4 leading-7 text-slate-600">{test.description}</p>}
        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          {test.sampleType && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sample type</dt><dd className="mt-1 font-medium text-slate-800">{test.sampleType}</dd></div>}
          {test.preparations && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preparation</dt><dd className="mt-1 font-medium text-slate-800">{test.preparations}</dd></div>}
          {test.reportTurnaround && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report turnaround</dt><dd className="mt-1 font-medium text-slate-800">{test.reportTurnaround}</dd></div>}
        </dl>
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          This is the platform-wide test catalog. Lab-specific test offerings, prices, and appointment availability are not configured in the current API. Contact a verified lab or submit a request that the lab can confirm.
        </p>
        <Link className="btn-primary mt-5" to="/lab-tests">Find a laboratory</Link>
      </article>
    </div>
  );
}
