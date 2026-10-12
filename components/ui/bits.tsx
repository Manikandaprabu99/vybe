'use client';

import { ReactNode } from 'react';

// Small shared pieces of the VYBE look.

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`press shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70 ${
        active ? 'bg-accent text-ink shadow-glow' : 'bg-white/[0.07] text-paper ring-1 ring-white/10'
      }`}
    >
      {children}
    </button>
  );
}

// Three bouncing bars marking the song that's playing (frozen when paused).
export function EqBars({ playing, className = '' }: { playing: boolean; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex h-3.5 items-end gap-[2px] ${className}`}>
      {[0, 0.25, 0.5].map((delay) => (
        <span
          key={delay}
          className={`w-[3px] origin-bottom rounded-full bg-marigold ${playing ? 'animate-eq' : 'scale-y-50'}`}
          style={{ height: '100%', animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

export function LiveBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-magenta/20 px-2 py-0.5 text-[10px] font-bold tracking-widest text-magenta ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-magenta animate-live-pulse" />
      LIVE
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center animate-rise-in">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-ink shadow-glow">{icon}</div>
      <p className="text-base font-bold text-paper">{title}</p>
      {body && <p className="mt-1 text-sm leading-relaxed text-haze">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-4">
      <h2 className="text-xl font-extrabold tracking-tight text-paper">{title}</h2>
      {action}
    </div>
  );
}

// Primary round play button with the accent gradient.
export function PlayFab({
  onClick,
  label,
  size = 56,
  children,
}: {
  onClick: () => void;
  label: string;
  size?: number;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{ width: size, height: size }}
      className="press flex shrink-0 items-center justify-center rounded-full bg-accent text-ink shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-paper/70"
    >
      {children}
    </button>
  );
}
