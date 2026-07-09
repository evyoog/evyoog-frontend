import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
}

export default function Card({ accent = false, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-white p-5 shadow-sm ${accent ? 'border-l-4 border-l-blue' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
