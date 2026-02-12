import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/uiStore';

export function Toasts() {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn('flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg min-w-[300px]', {
            'bg-green-100 text-green-800': toast.type === 'success',
            'bg-red-100 text-red-800': toast.type === 'error',
            'bg-blue-100 text-blue-800': toast.type === 'info',
          })}
        >
          {toast.type === 'success' && <CheckCircle className="h-5 w-5" />}
          {toast.type === 'error' && <AlertCircle className="h-5 w-5" />}
          {toast.type === 'info' && <Info className="h-5 w-5" />}
          <span className="flex-1 text-sm">{toast.message}</span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:bg-black/10 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
