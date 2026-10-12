'use client';

import { create } from 'zustand';

// One short confirmation at a time ("Added to queue"), shown by
// components/Toaster.tsx. `id` changes on every call so repeating the same
// message still restarts its timer.
interface ToastState {
  message: string | null;
  id: number;
  show: (message: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  id: 0,
  show: (message) => set((s) => ({ message, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));
