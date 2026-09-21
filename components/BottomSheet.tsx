'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-dusk rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-paper">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-haze focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60 rounded"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
