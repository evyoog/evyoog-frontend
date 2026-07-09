import type { JournalStatus } from '../../types';

const statusClasses: Record<JournalStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate',
  PENDING_APPROVAL: 'bg-amber-light text-amber',
  APPROVED: 'bg-blue-light text-blue-dark',
  POSTED: 'bg-green-light text-green',
  REVERSED: 'bg-blue-light text-blue',
  CANCELLED: 'bg-red-50 text-red-600',
};

interface BadgeProps {
  status: JournalStatus;
}

export default function Badge({ status }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${statusClasses[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
