import { restoPreset } from '@resto/ui/tailwind-preset';
import type { Config } from 'tailwindcss';

const config = {
  presets: [restoPreset],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // docs/09_DESIGN_SYSTEM.md §4.1: Nunito para títulos, Nunito Sans para la interfaz.
        titulo: ['var(--font-titulo)', 'sans-serif'],
        sans: ['var(--font-interfaz)', 'sans-serif'],
      },
    },
  },
} satisfies Config;

export default config;
