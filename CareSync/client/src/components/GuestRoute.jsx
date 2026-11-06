import { LoaderCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';

export function GuestRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center px-5" role="status">
        <LoaderCircle aria-hidden="true" className="animate-spin text-teal-800" size={28} />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  if (user) return <Navigate replace to="/dashboard" />;
  return children;
}
