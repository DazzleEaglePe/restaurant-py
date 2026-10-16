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
    },
  },
} satisfies Config;

export default restoPreset;
