import { useId } from 'react';

export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  const child = children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined });
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {child}
      {error ? <span id={`${id}-err`} className="field-error">{error}</span> : hint ? <span id={`${id}-hint`} className="hint">{hint}</span> : null}
    </div>
  );
}
export const TextField = ({ label, error, hint, value, onChange, type = 'text', className, ...rest }) => (
  <Field label={label} error={error} hint={hint} className={className}>
    {(p) => <input className="input" type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...p} {...rest} />}
  </Field>
);
export const SelectField = ({ label, error, hint, value, onChange, children, className, ...rest }) => (
  <Field label={label} error={error} hint={hint} className={className}>
    {(p) => <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...p} {...rest}>{children}</select>}
  </Field>
);
export function FormAlert({ error }) {
  if (!error) return null;
  const stock = error.code === 'INSUFFICIENT_STOCK' ? error.details : null;
  return (
    <div className="alert bad" role="alert">
      {error.message}
      {stock?.length > 0 && (
        <ul>{stock.map((d, i) => <li key={i}>{d.name ? `${d.name}: ` : ''}requested {d.requested ?? Math.abs(d.requested_change)}, available {d.available}</li>)}</ul>
      )}
    </div>
  );
}
