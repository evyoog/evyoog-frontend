import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export default function Select({ label, id, className = '', children, ...rest }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-slate">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`rounded-md border border-border bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-blue focus:ring-1 focus:ring-blue ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
