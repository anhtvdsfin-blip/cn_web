import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function InputModal({ 
  isOpen = true, // Support both conditional rendering and isOpen prop
  onClose, 
  onCancel, // Alias for onClose
  onSubmit, 
  title = 'Nhập thông tin',
  message,
  placeholder = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  required = false,
  value: externalValue, // Support controlled mode
  onChange: externalOnChange // Support controlled mode
}) {
  const [internalValue, setInternalValue] = useState('');
  
  // Use external value if provided (controlled mode), otherwise internal state
  const value = externalValue !== undefined ? externalValue : internalValue;
  const setValue = externalOnChange !== undefined ? externalOnChange : setInternalValue;

  // Reset internal value when modal opens
  useEffect(() => {
    if (isOpen && externalValue === undefined) {
      setInternalValue('');
    }
  }, [isOpen, externalValue]);

  if (!isOpen) return null;

  const handleClose = onCancel || onClose;

  const handleSubmit = () => {
    if (required && !value.trim()) return;
    onSubmit(value);
    if (externalValue === undefined) {
      setInternalValue('');
    }
    handleClose?.();
  };

  const handleCancel = () => {
    if (externalValue === undefined) {
      setInternalValue('');
    }
    handleClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-rose-950/40 backdrop-blur-sm"
        onClick={handleCancel}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-md mx-4 overflow-hidden rounded-[28px] border border-rose-100/60 bg-white/95 p-6 shadow-[0_25px_60px_-20px_rgba(244,114,182,0.4)] backdrop-blur-xl animate-modalIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleCancel}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-400 transition hover:bg-rose-100 hover:text-rose-600"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-center text-lg font-semibold text-slate-800">{title}</h3>

        {/* Message */}
        {message && <p className="mt-2 text-center text-sm text-slate-500">{message}</p>}

        {/* Input */}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="mt-4 h-28 w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-sm text-slate-700 placeholder-rose-300/70 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-200"
          autoFocus
        />

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 rounded-full border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleSubmit}
            disabled={required && !value.trim()}
            className="flex-1 rounded-full bg-gradient-to-r from-[#f7b0d2] via-[#f59fb6] to-[#fdd2b7] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
