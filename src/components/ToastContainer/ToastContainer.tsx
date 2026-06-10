import { useToastStore } from '../../store/toastStore';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast-item">
          <span className="emergency-badge" style={{ background: toast.color }}>
            {toast.label}
          </span>
          <span className="toast-callsign">{toast.aircraft.flight || toast.aircraft.hex}</span>
          <button className="icon-btn" onClick={() => removeToast(toast.id)} aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  );
}
