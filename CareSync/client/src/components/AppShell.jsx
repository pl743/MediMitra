import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Brand } from './Brand.jsx';
import { useAuth } from '../context/useAuth.js';

const navigation = [
  { to: '/', label: 'Home', end: true },
  { to: '/doctors', label: 'Doctors' },
  { to: '/lab-tests', label: 'Lab tests' },
  { to: '/medicines', label: 'Medicines' },
];

export function AppShell() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { user, logout } = useAuth();
  const links = user?.role === 'patient'
    ? [
      ...navigation,
      { to: '/appointments', label: 'My appointments' },
      { to: '/lab-bookings', label: 'My lab bookings' },
      { to: '/reservations/my', label: 'My reservations' },
      { to: '/care-journey', label: 'Care journey' },
      { to: '/waitlist', label: 'My waitlist' },
      { to: '/consents', label: 'Record sharing' },
      { to: '/notifications', label: 'Notifications' },
    ]
    : user?.role === 'pharmacist'
      ? [...navigation, { to: '/pharmacy/inventory', label: 'Pharmacy inventory' }, { to: '/notifications', label: 'Notifications' }]
      : user
        ? [...navigation, ...(user.role === 'admin' ? [{ to: '/admin', label: 'Admin dashboard' }] : []), { to: '/notifications', label: 'Notifications' }]
    : navigation;
  const navigate = useNavigate();

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      setIsMenuOpen(false);
      navigate('/');
    } catch {
      setLogoutError('We could not log you out. Please try again.');
    }
  }

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {links.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-teal-50 text-teal-900' : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
                  }`
                }
                end={item.end}
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            {user ? (
              <>
                <Link className="quiet-link text-sm" to="/dashboard">
                  Dashboard
                </Link>
                <button className="btn-secondary px-4 py-2 text-sm" onClick={handleLogout} type="button">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link className="quiet-link px-2 py-2 text-sm" to="/login">
                  Log in
                </Link>
                <Link className="btn-primary px-4 py-2.5 text-sm" to="/register">
                  Create account
                </Link>
              </>
            )}
          </div>
          <button
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
            onClick={() => setIsMenuOpen((open) => !open)}
            type="button"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {isMenuOpen && (
          <nav aria-label="Mobile navigation" className="border-t border-slate-100 bg-white px-5 py-3 lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {links.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-3 text-sm font-semibold ${
                      isActive ? 'bg-teal-50 text-teal-900' : 'text-slate-700 hover:bg-slate-50'
                    }`
                  }
                  end={item.end}
                  key={item.to}
                  onClick={closeMenu}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
              {user ? (
                <>
                  <Link className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700" onClick={closeMenu} to="/dashboard">
                    Dashboard
                  </Link>
                  <button className="btn-secondary mt-1 w-full" onClick={handleLogout} type="button">
                    Log out
                  </button>
                </>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <Link className="btn-secondary" onClick={closeMenu} to="/login">
                    Log in
                  </Link>
                  <Link className="btn-primary" onClick={closeMenu} to="/register">
                    Register
                  </Link>
                </div>
              )}
              {logoutError && <p className="px-3 pt-2 text-sm text-rose-700" role="alert">{logoutError}</p>}
            </div>
          </nav>
        )}
      </header>

      <main className="page-shell flex-1">
        {logoutError && !isMenuOpen && (
          <p className="mx-auto max-w-7xl px-5 pt-4 text-sm text-rose-700 sm:px-8" role="alert">
            {logoutError}
          </p>
        )}
        <Outlet />
      </main>

      <footer className="bg-ink text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Brand footer />
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
              Thoughtful tools for a more connected healthcare experience.
            </p>
          </div>
          <p className="text-sm text-slate-400">CareSync · Smart Healthcare Coordination Platform</p>
        </div>
      </footer>
    </div>
  );
}
