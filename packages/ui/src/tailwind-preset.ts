import { colores, curvas, duraciones } from '@resto/design-tokens';
import type { Config } from 'tailwindcss';

// Las clases apuntan a variables CSS, no a valores fijos: el mismo
// `bg-brand` sirve en el tema claro y en el noche (docs/09_DESIGN_SYSTEM.md §12).
const color = Object.fromEntries(
  Object.keys(colores.claro).map((nombre) => [nombre, `var(--color-${nombre})`]),
);

export const restoPreset = {
  content: [],
  theme: {
    extend: {
      colors: color,
      transitionDuration: Object.fromEntries(
        Object.keys(duraciones).map((nombre) => [nombre, `var(--motion-${nombre})`]),
      ),
      transitionTimingFunction: Object.fromEntries(
        Object.keys(curvas).map((nombre) => [nombre, `var(--ease-${nombre})`]),
      ),
      // docs/09_DESIGN_SYSTEM.md §9.3 y §9.4. Se usan con `motion-safe:` para
      // respetar «reducir movimiento».
      keyframes: {
        entrada: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        sacudida: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
        flotar: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        latido: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        entrada: 'entrada var(--motion-base) var(--ease-enter) both',
        sacudida: 'sacudida 300ms var(--ease-standard)',
        flotar: 'flotar 1.6s var(--ease-standard) infinite',
        latido: 'latido 1.2s var(--ease-standard) infinite',
      },
    },
  },
} satisfies Config;

export default restoPreset;
