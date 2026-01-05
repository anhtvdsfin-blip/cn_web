import { X } from 'lucide-react';

export default function ConfirmModal({ 
  isOpen = true, // Support both conditional rendering and isOpen prop
  onClose, 
  onCancel, // Alias for onClose
  onConfirm, 
  title = 'Xác nhận',
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  type = 'default' // 'default', 'danger', 'warning'
}) {
  if (!isOpen) return null;

  const handleClose = onCancel || onClose;

  const getButtonStyles = () => {
    switch (type) {
      case 'danger':
        return 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 shadow-lg shadow-rose-200';
      case 'warning':
        return 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 shadow-lg shadow-amber-200';
      default:
        return 'bg-gradient-to-r from-[#f7b0d2] via-[#f59fb6] to-[#fdd2b7] hover:opacity-90 shadow-lg shadow-rose-200';
    }
  };

  const handleConfirm = () => {
    onConfirm();
    handleClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-rose-950/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-sm mx-4 overflow-hidden rounded-[28px] border border-rose-100/60 bg-white/95 p-6 shadow-[0_25px_60px_-20px_rgba(244,114,182,0.4)] backdrop-blur-xl animate-modalIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-400 transition hover:bg-rose-100 hover:text-rose-600"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full ${
            type === 'danger' ? 'bg-rose-100 text-rose-500' : 
            type === 'warning' ? 'bg-amber-100 text-amber-500' : 
            'bg-rose-100 text-rose-500'
          }`}>
            {type === 'danger' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-center text-lg font-semibold text-slate-800">{title}</h3>

        {/* Message */}
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">{message}</p>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 rounded-full border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition ${getButtonStyles()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modalIn {
          animation: modalIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
