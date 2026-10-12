'use client';

import { ReactNode, TouchEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// A modern bottom sheet: slides up, drag the handle (or the title) down to
// dismiss, tap outside or press Escape to close. Rendered at the end of
// <body> so no transformed parent (the now-playing screen while it's being
// swiped) can trap its fixed positioning.
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
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setDragY(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const onTouchStart = (e: TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current !== null) setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (dragY > 90) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-[28px] bg-night ring-1 ring-white/10 shadow-float animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: startY.current !== null ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className="touch-none px-5 pb-2 pt-3" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="mx-auto h-1.5 w-10 rounded-full bg-white/25" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <h2 className="truncate text-base font-bold text-paper">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="press -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-haze focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto overscroll-contain px-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
