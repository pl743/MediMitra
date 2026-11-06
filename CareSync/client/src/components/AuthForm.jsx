import { useState } from 'react';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { api, getApiErrorMessage } from '../services/api.js';

export function AuthForm({ mode }) {
  const isRegister = mode === 'register';
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    role: 'patient',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateValue(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const { data } = await api.post(
        isRegister ? '/auth/register' : '/auth/login',
        isRegister
          ? {
              firstName: values.firstName,
              lastName: values.lastName,
              email: values.email,
              password: values.password,
              phone: values.phone || undefined,
              role: values.role,
            }
          : { email: values.email, password: values.password }
      );
      setUser(data.data.user, data.message);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'We could not reach CareSync. Check that the backend is running and try again.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(24,58,69,0.08)] md:grid-cols-[0.85fr_1.15fr]">
        <aside className="hidden flex-col justify-between bg-ink p-9 text-white md:flex lg:p-11">
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-teal-100">
              <ShieldCheck aria-hidden="true" size={24} />
            </span>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-teal-200">Care, connected</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
              A more considered way to manage your care journey.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Your CareSync account brings your platform experience together in one place.
            </p>
          </div>
          <p className="mt-10 border-t border-white/10 pt-5 text-xs leading-5 text-slate-400">
            Sign in only on a device you trust. Your session is managed with secure cookies.
          </p>
        </aside>

        <section className="p-6 sm:p-9 lg:p-11">
          <p className="eyebrow">{isRegister ? 'Join CareSync' : 'Welcome back'}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">
            {isRegister ? 'Create your account' : 'Sign in to CareSync'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isRegister
              ? 'Enter your details to get started. Provider accounts may require verification.'
              : 'Use the email and password associated with your account.'}
          </p>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            {isRegister && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="firstName">
                  First name
                  <input
                    autoComplete="given-name"
                    className="form-control mt-1.5"
                    id="firstName"
                    maxLength={50}
                    minLength={2}
                    name="firstName"
                    onChange={updateValue}
                    required
                    autoCapitalize="words"
                    value={values.firstName}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="lastName">
                  Last name
                  <input
                    autoComplete="family-name"
                    className="form-control mt-1.5"
                    id="lastName"
                    maxLength={50}
                    minLength={2}
                    name="lastName"
                    onChange={updateValue}
                    required
                    autoCapitalize="words"
                    value={values.lastName}
                  />
                </label>
              </div>
            )}

            <label className="block text-sm font-semibold text-slate-700" htmlFor="email">
              Email address
              <input
                autoComplete="email"
                className="form-control mt-1.5"
                id="email"
                name="email"
                onChange={updateValue}
                required
                type="email"
                value={values.email}
              />
            </label>

            {isRegister && (
              <label className="block text-sm font-semibold text-slate-700" htmlFor="phone">
                Phone <span className="font-normal text-slate-500">(optional)</span>
                <input
                  autoComplete="tel"
                  className="form-control mt-1.5"
                  id="phone"
                  maxLength={15}
                  name="phone"
                  onChange={updateValue}
                  type="tel"
                  value={values.phone}
                />
              </label>
            )}

            <label className="block text-sm font-semibold text-slate-700" htmlFor="password">
              Password
              <input
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="form-control mt-1.5"
                id="password"
                maxLength={72}
                minLength={isRegister ? 8 : 1}
                name="password"
                onChange={updateValue}
                pattern={isRegister ? '(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,72}' : undefined}
                required
                type="password"
                value={values.password}
              />
              {isRegister && (
                <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                  Use at least 8 characters with an uppercase letter, a lowercase letter, and a number.
                </span>
              )}
            </label>

            {isRegister && (
              <label className="block text-sm font-semibold text-slate-700" htmlFor="role">
                Account type
                <select className="form-control mt-1.5" id="role" name="role" onChange={updateValue} value={values.role}>
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="lab_staff">Lab staff</option>
                  <option value="pharmacist">Pharmacist</option>
                </select>
                <span className="mt-1.5 block text-xs font-normal text-slate-500">
                  Provider accounts are subject to approval by an administrator.
                </span>
              </label>
            )}

            {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>}

            <button className="btn-primary min-h-12 w-full justify-center px-5" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
                  {isRegister ? 'Creating account…' : 'Signing in…'}
                </>
              ) : (
                <>
                  {isRegister ? 'Create account' : 'Sign in'}
                  <ArrowRight aria-hidden="true" size={17} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {isRegister ? 'Already have an account?' : 'New to CareSync?'}{' '}
            <Link className="quiet-link" to={isRegister ? '/login' : '/register'}>
              {isRegister ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
