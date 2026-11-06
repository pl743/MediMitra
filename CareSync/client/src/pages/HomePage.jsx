import {
  ArrowRight,
  CalendarDays,
  ClipboardPlus,
  HeartPulse,
  Microscope,
  Pill,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const services = [
  {
    icon: UsersRound,
    title: 'Find a doctor',
    description: 'Explore the doctor directory and narrow your search by specialty.',
    to: '/doctors',
    label: 'Browse doctors',
  },
  {
    icon: Microscope,
    title: 'Explore lab tests',
    description: 'Search the diagnostic test catalog and review available test details.',
    to: '/lab-tests',
    label: 'View lab tests',
  },
  {
    icon: Pill,
    title: 'Look up medicines',
    description: 'Search the medicine catalog by generic name or manufacturer.',
    to: '/medicines',
    label: 'Search medicines',
  },
];

export function HomePage() {
  return (
    <>
      <section className="overflow-hidden bg-[#eff8f5]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-24">
          <div className="relative z-10">
            <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-700" />
              A clearer path to care
            </p>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.1] tracking-[-0.045em] text-ink sm:text-5xl lg:text-[3.55rem]">
              Healthcare works better when it works <span className="text-teal-800">together.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              CareSync brings healthcare services into one thoughtful place, helping you find care and keep the next step in view.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="btn-primary min-h-12 justify-center px-6" to="/doctors">
                Explore care options <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link className="btn-secondary min-h-12 justify-center px-6" to="/register">
                Create your account
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="text-teal-800" size={17} /> Private by design</span>
              <span className="inline-flex items-center gap-2"><HeartPulse className="text-teal-800" size={17} /> Care centered around you</span>
            </div>
          </div>

          <div aria-label="Illustration of coordinated healthcare information" className="relative mx-auto w-full max-w-[550px]" role="img">
            <div className="absolute -left-7 top-14 h-28 w-28 rounded-full border border-teal-200/80" />
            <div className="absolute -right-4 bottom-6 h-20 w-20 rounded-3xl bg-[#dcefe9]" />
            <div className="relative rounded-[2rem] border border-white bg-white p-3 shadow-[0_30px_90px_rgba(27,72,78,0.12)] sm:p-5">
              <div className="rounded-[1.45rem] bg-[#f7faf9] p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Your care, connected</p>
                    <div aria-hidden="true" className="mt-3 h-5 w-36 rounded-md bg-ink/90 sm:w-48" />
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-900">
                    <HeartPulse aria-hidden="true" size={22} />
                  </span>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f4f1] text-teal-800">
                      <CalendarDays aria-hidden="true" size={18} />
                    </span>
                    <div aria-hidden="true" className="mt-4 h-2.5 w-20 rounded bg-slate-200" />
                    <div aria-hidden="true" className="mt-2 h-2 w-14 rounded bg-slate-100" />
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eff2fb] text-indigo-800">
                      <ClipboardPlus aria-hidden="true" size={18} />
                    </span>
                    <div aria-hidden="true" className="mt-4 h-2.5 w-24 rounded bg-slate-200" />
                    <div aria-hidden="true" className="mt-2 h-2 w-16 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#e8f4f1] text-teal-800">
                    <HeartPulse aria-hidden="true" size={19} />
                  </div>
                  <div className="flex-1">
                    <div aria-hidden="true" className="h-2.5 w-32 rounded bg-slate-200" />
                    <div aria-hidden="true" className="mt-2 h-2 w-24 rounded bg-slate-100" />
                  </div>
                  <div aria-hidden="true" className="h-2 w-2 rounded-full bg-teal-600" />
                </div>
                <div aria-hidden="true" className="mt-6 flex items-end gap-2 border-b border-slate-200 pb-1">
                  {[34, 52, 42, 69, 57, 82, 61, 93, 73, 100, 79, 91].map((height, index) => (
                    <span
                      className={`w-full rounded-t-sm ${index === 9 ? 'bg-teal-700' : 'bg-teal-200'}`}
                      key={index}
                      style={{ height: `${height * 0.42}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-lg sm:left-0">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-50 text-teal-800">
                <ShieldCheck aria-hidden="true" size={18} />
              </span>
              <span className="text-sm font-semibold text-ink">One connected experience</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Care, made easier to navigate</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">Start with what you need</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-600">
            Find your way through the available directories and catalogs. Listings depend on your care team’s setup.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {services.map(({ icon: Icon, title, description, to, label }) => (
            <article className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg" key={to}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-800 transition group-hover:bg-teal-100">
                <Icon aria-hidden="true" size={23} strokeWidth={1.8} />
              </span>
              <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{description}</p>
              <Link className="quiet-link mt-5 inline-flex items-center gap-2 text-sm" to={to}>
                {label} <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e8f4f1] text-teal-800">
              <ShieldCheck aria-hidden="true" size={21} />
            </span>
            <div>
              <h2 className="font-bold text-ink">Your information deserves care.</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Account access is handled through secure, cookie-based authentication.</p>
            </div>
          </div>
          <Link className="quiet-link inline-flex items-center gap-2 text-sm" to="/register">
            Get started <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </section>
    </>
  );
}
