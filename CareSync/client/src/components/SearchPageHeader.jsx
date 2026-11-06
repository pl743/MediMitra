export function SearchPageHeader({ eyebrow, title, description, icon: Icon }) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
      </div>
      <span className="hidden h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-800 sm:grid">
        <Icon aria-hidden="true" size={27} strokeWidth={1.8} />
      </span>
    </div>
  );
}

export function SearchBox({ label, value, onChange, onSubmit, placeholder, buttonLabel = 'Search' }) {
  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="catalog-search">{label}</label>
      <input
        autoComplete="off"
        className="form-control min-h-12"
        id="catalog-search"
        onChange={onChange}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      <button className="btn-primary min-h-12 px-6" type="submit">{buttonLabel}</button>
    </form>
  );
}
