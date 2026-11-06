import { AlertCircle, LoaderCircle, SearchX } from 'lucide-react';

export function LoadingState({ label = 'Loading results' }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-center" role="status">
      <LoaderCircle aria-hidden="true" className="animate-spin text-teal-700" size={27} />
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center" role="alert">
      <AlertCircle aria-hidden="true" className="mx-auto text-rose-700" size={25} />
      <h2 className="mt-3 font-semibold text-rose-950">We couldn’t load this right now</h2>
      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-rose-800">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-4 border-rose-200 text-rose-900 hover:bg-white" onClick={onRetry} type="button">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, message }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500">
        <SearchX aria-hidden="true" size={21} />
      </span>
      <h2 className="mt-3 font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{message}</p>
    </div>
  );
}
