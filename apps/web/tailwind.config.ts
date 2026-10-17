import { restoPreset } from '@resto/ui/tailwind-preset';
import type { Config } from 'tailwindcss';

const config = {
  presets: [restoPreset],
  // Los componentes de @resto/ui también usan clases de Tailwind.
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
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
