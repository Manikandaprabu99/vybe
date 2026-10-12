'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Radio, Library } from 'lucide-react';

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/radio', label: 'Radio', icon: Radio },
  { href: '/library', label: 'Library', icon: Library },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href) || (href === '/library' && /^\/(liked|playlist)/.test(pathname));

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md justify-around px-2 pb-1.5 pt-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className="group flex min-w-[64px] flex-col items-center gap-1 rounded-2xl px-2 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold/70"
            >
              {/* Material-style pill behind the active icon. */}
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200 ${
                  active ? 'bg-white/[0.12] text-marigold' : 'text-haze group-active:bg-white/[0.06]'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
              </span>
              <span className={`text-[11px] font-semibold ${active ? 'text-paper' : 'text-haze'}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
