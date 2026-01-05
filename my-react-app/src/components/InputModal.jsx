import { useState } from 'react';
import { X } from 'lucide-react';

export default function InputModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title = 'Nhập thông tin',
  message,
  placeholder = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  required = false
}) {
  const [value, setValue] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (required && !value.trim()) return;
    onSubmit(value);
    setValue('');
    onClose();
  };

  const handleCancel = () => {
    setValue('');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={handleCancel}
      >
        {/* Modal */}
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <button
              onClick={handleCancel}
              className="p-1 hover:bg-slate-100 rounded-full transition"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          {/* Message */}
          {message && <p className="text-slate-600 mb-4">{message}</p>}

          {/* Input */}
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
            rows={3}
            autoFocus
          />

          {/* Actions */}
          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              {cancelText}
            </button>
            <button
              onClick={handleSubmit}
              disabled={required && !value.trim()}
              className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
