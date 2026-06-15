// Labeled form control with an accessible error message. Renders an <input> by default,
// or any element passed as children (e.g. <select>, <textarea>) when `as="custom"`.
export default function Field({ label, id, error, hint, as, children, ...inputProps }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {as === 'custom' ? children : (
        <input id={id} className={error ? 'input input-error' : 'input'}
          aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />
      )}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}
