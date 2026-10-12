'use client';

import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { useToast } from '@/lib/toast';

export default function Toaster() {
  const message = useToast((s) => s.message);
  const id = useToast((s) => s.id);
  const hide = useToast((s) => s.hide);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(hide, 2200);
    return () => clearTimeout(timeout);
  }, [message, id, hide]);

  return (
    // Floats just above the mini player and nav; announced to screen readers.
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-[80] flex justify-center px-4"
    >
      {message && (
        <div
          key={id}
          className="flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink shadow-float animate-rise-in"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
            <Check size={13} strokeWidth={3} />
          </span>
          {message}
        </div>
      )}
    </div>
  );
}
