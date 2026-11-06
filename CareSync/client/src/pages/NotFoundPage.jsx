import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-7xl flex-col items-center justify-center px-5 text-center sm:px-8">
      <p className="eyebrow">404 · Page not found</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink">This page isn’t here</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">The address may have changed, or the page may not exist.</p>
      <Link className="btn-primary mt-6" to="/"><ArrowLeft aria-hidden="true" size={16} /> Back to home</Link>
    </div>
  );
}
