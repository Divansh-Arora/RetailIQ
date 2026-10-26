export const Loading = ({ label = 'Loading…' }) => (
  <div className="state" role="status"><div className="spinner" aria-hidden="true" />{label}</div>
);
export const ErrorState = ({ error, onRetry }) => (
  <div className="state error" role="alert">
    <strong>We couldn’t load this</strong>
    {error?.message || 'Something went wrong.'}
    {onRetry && <div style={{ marginTop: 12 }}><button className="btn small" onClick={onRetry}>Try again</button></div>}
  </div>
);
export const Empty = ({ title = 'Nothing to show', children }) => (
  <div className="state"><strong>{title}</strong>{children}</div>
);
/** Renders loading / error / empty / content for a useFetch result. */
export function Async({ state, isEmpty, empty, children }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  if (isEmpty?.(state.data)) return empty || <Empty />;
  return children(state.data);
}
