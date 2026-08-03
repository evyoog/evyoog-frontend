import type { ReactNode } from 'react';
import Button from './Button';

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

const linkVariantClasses: Record<'primary' | 'ghost', string> = {
  primary: 'bg-blue text-white hover:bg-blue-dark',
  ghost: 'bg-transparent text-blue hover:bg-blue-light',
};

function EmptyStateActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction;
  variant: 'primary' | 'ghost';
}) {
  if (action.href) {
    return (
      <a
        href={action.href}
        onClick={action.onClick}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${linkVariantClasses[variant]}`}
      >
        {action.label}
      </a>
    );
  }
  return (
    <Button variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 px-6 py-10 text-center ${className}`}
    >
      {icon && (
        <div className="mb-1 text-4xl text-slate/60" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-navy">{title}</p>
      {message && <p className="text-sm text-slate">{message}</p>}
      {(action || secondaryAction) && (
        <div className="mt-3 flex items-center gap-3">
          {action && <EmptyStateActionButton action={action} variant="primary" />}
          {secondaryAction && <EmptyStateActionButton action={secondaryAction} variant="ghost" />}
        </div>
      )}
    </div>
  );
}
