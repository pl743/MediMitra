import { ArrowRight, CircleUserRound, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';

export function DashboardPage() {
  const { user, authNotice } = useAuth();

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      {authNotice && (
        <p className="mb-6 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-950" role="status">
          {authNotice}
        </p>
      )}
      <p className="eyebrow">Your CareSync</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Welcome, {user.firstName}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
        Your account is connected. Use these shortcuts to review care activity, coordinate bookings, and manage your account.
      </p>

      <section className="mt-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-800">
            <CircleUserRound aria-hidden="true" size={23} />
          </span>
          <div>
            <h2 className="font-bold text-ink">Account details</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">These details come from your authenticated CareSync account.</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</dt>
            <dd className="mt-1 font-medium text-slate-800">{[user.firstName, user.lastName].filter(Boolean).join(' ')}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-1 break-all font-medium text-slate-800">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account type</dt>
            <dd className="mt-1 font-medium capitalize text-slate-800">{user.role?.replaceAll('_', ' ')}</dd>
          </div>
          <div className="flex items-center gap-2 text-sm text-teal-900">
            <ShieldCheck aria-hidden="true" size={17} />
            Signed in securely
          </div>
        </dl>
      </section>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-lg font-bold text-ink">Explore CareSync</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="btn-secondary" to="/doctors">Browse doctors <ArrowRight aria-hidden="true" size={15} /></Link>
          {user.role === 'patient' && (
            <>
              <Link className="btn-secondary" to="/appointments">My appointments <ArrowRight aria-hidden="true" size={15} /></Link>
              <Link className="btn-secondary" to="/lab-bookings">My lab bookings <ArrowRight aria-hidden="true" size={15} /></Link>
              <Link className="btn-secondary" to="/reservations/my">My reservations <ArrowRight aria-hidden="true" size={15} /></Link>
              <Link className="btn-secondary" to="/care-journey">Care journey <ArrowRight aria-hidden="true" size={15} /></Link>
              <Link className="btn-secondary" to="/waitlist">My waitlist <ArrowRight aria-hidden="true" size={15} /></Link>
              <Link className="btn-secondary" to="/consents">Record sharing <ArrowRight aria-hidden="true" size={15} /></Link>
            </>
          )}
          {user.role === 'pharmacist' && (
            <Link className="btn-secondary" to="/pharmacy/inventory">Pharmacy inventory <ArrowRight aria-hidden="true" size={15} /></Link>
          )}
          {user.role === 'admin' && (
            <Link className="btn-secondary" to="/admin">Admin dashboard <ArrowRight aria-hidden="true" size={15} /></Link>
          )}
          <Link className="btn-secondary" to="/lab-tests">Explore lab tests <ArrowRight aria-hidden="true" size={15} /></Link>
          <Link className="btn-secondary" to="/medicines">Search medicines <ArrowRight aria-hidden="true" size={15} /></Link>
          <Link className="btn-secondary" to="/notifications">Notifications <ArrowRight aria-hidden="true" size={15} /></Link>
        </div>
      </section>
    </div>
  );
}
