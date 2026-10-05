// A spinner with a label, shown wherever something is still loading.
export function Loader({ label = 'Loading…', page = false }: { label?: string; page?: boolean }) {
  return <div className={`loader ${page ? 'page' : ''}`} role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}
