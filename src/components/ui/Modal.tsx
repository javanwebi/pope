import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'پنجره اطلاعات'}
      onMouseDown={onClose}
    >
      <div
        dir="rtl"
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full ${SIZE_CLASSES[size]} max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-right shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-[#FAF8F5] px-4 sm:px-5 py-3.5">
          <h3 className="text-sm font-black text-[#2B313A] truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-[#E06518] hover:text-[#E06518] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
};
