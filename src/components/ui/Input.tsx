import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, id, required, className = '', ...rest }: InputProps) {
  const errorId = error && id ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-slate">
          {label}
          {required && (
            <span className="text-red-500" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      <input
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={errorId}
        className={`rounded-md border border-border bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-blue focus:ring-1 focus:ring-blue ${error ? 'border-red-500' : ''} ${className}`}
        {...rest}
      />
      {error && (
        <span id={errorId} className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
