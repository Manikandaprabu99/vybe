import type { Config } from 'tailwindcss';

// VYBE's design tokens: a deep aubergine night with warm festival light —
// marigold into magenta — rather than Spotify's black-and-green. Surfaces are
// layered translucency over the base, so artwork colour bleeds through.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0E0913', // app background
        night: '#17101E', // sheets, nav — one step up
        dusk: '#221830', // cards and surfaces
        'dusk-hover': '#2C2039',
        paper: '#F8EFE6', // primary text
        haze: '#AB9CB4', // secondary text (AA on every surface)
        marigold: '#F5A623', // primary accent
        ember: '#FF7A45', // the middle of the accent gradient
        magenta: '#E4457A', // secondary accent
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        accent: 'linear-gradient(135deg, #F5A623 0%, #FF7A45 45%, #E4457A 100%)',
      },
      boxShadow: {
        glow: '0 12px 32px -8px rgba(245, 166, 35, 0.55)',
        float: '0 12px 32px -12px rgba(0, 0, 0, 0.7)',
        art: '0 28px 60px -24px rgba(0, 0, 0, 0.85)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.3)' }, '100%': { transform: 'scale(1)' } },
        eq: { '0%, 100%': { transform: 'scaleY(0.35)' }, '50%': { transform: 'scaleY(1)' } },
        'live-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgba(228, 69, 122, 0.7)' },
          '100%': { boxShadow: '0 0 0 7px rgba(228, 69, 122, 0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 380ms cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 220ms ease-out',
        'rise-in': 'rise-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        pop: 'pop 320ms ease-out',
        eq: 'eq 0.9s ease-in-out infinite',
        'live-pulse': 'live-pulse 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
