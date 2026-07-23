export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const typeClasses: Record<ToastType, string> = {
  success: 'border-l-green bg-green-light text-green',
  error: 'border-l-red-600 bg-red-50 text-red-600',
  warning: 'border-l-amber bg-amber-light text-amber',
  info: 'border-l-blue bg-blue-light text-blue-dark',
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`flex items-start justify-between gap-3 rounded-md border-l-4 px-4 py-3 text-sm shadow-lg ${typeClasses[toast.type]}`}
        >
          <span className="font-medium">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
