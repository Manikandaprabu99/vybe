import type { Config } from 'tailwindcss';

// Design tokens grounded in the subject: a warm, dusk/festival-light palette
// (not Spotify's black-and-green, not a generic dark-mode purple gradient).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1B1023', // background
        dusk: '#2E1B3A', // surfaces / cards / sheets
        'dusk-hover': '#3A2448',
        paper: '#F7EDE4', // primary text
        haze: '#9C8AA5', // secondary text
        marigold: '#F5A623', // primary accent — CTAs, active states
        magenta: '#E4457A', // secondary accent — used sparingly
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
