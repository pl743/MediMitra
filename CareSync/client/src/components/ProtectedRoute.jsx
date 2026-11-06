import { LoaderCircle } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ErrorState } from './PageStates.jsx';
import { useAuth } from '../context/useAuth.js';

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, isLoading, sessionError, retrySession } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center px-5" role="status">
        <LoaderCircle aria-hidden="true" className="animate-spin text-teal-800" size={28} />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <ErrorState message={sessionError} onRetry={retrySession} />
        <p className="mt-4 text-center text-sm text-slate-600">
          You can also <Link className="quiet-link" to="/login">go to sign in</Link>.
        </p>
      </div>
    );
  }

  if (!user) return <Navigate replace state={{ from: location }} to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="mx-auto flex min-h-[45vh] max-w-7xl flex-col items-center justify-center px-5 text-center">
        <h1 className="text-2xl font-bold text-ink">Your account cannot access this page</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
          This area is restricted to a different account role.
        </p>
        <Link className="btn-secondary mt-5" to="/">Return home</Link>
      </div>
    );
  }
  return children;
}
