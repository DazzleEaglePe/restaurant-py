/**
 * Línea gráfica Marino (docs/09_DESIGN_SYSTEM.md §3.1, §9.2 y §12).
 *
 * Dos temas con los mismos nombres de token: `claro` (Marino clásico) para caja,
 * salón y administración, y `noche` (Marino noche) para cocina y pantalla pública.
 */

export type Tema = 'claro' | 'noche';

export type ColoresTema = {
  brand: string;
  ink: string;
  bg: string;
  surface: string;
  muted: string;
  line: string;
  accent: string;
  soft: string;
};

export const colores: Record<Tema, ColoresTema> = {
  claro: {
    brand: '#0E4C7A', // Marino
    ink: '#0B2540', // Abismo
    bg: '#FFF8F0', // Arena
    surface: '#FFFFFF', // Blanco
    muted: '#56677A', // Gris mar
    line: '#E6DCCD', // Línea
    accent: '#FF6B57', // Coral: «ding» y destacados, nunca texto pequeño
    soft: '#E3EEF7', // Cielo
  },
  noche: {
    brand: '#FF6B57', // Coral, con texto oscuro encima
    ink: '#EAF4FB', // Bruma
    bg: '#081C33', // Noche
    surface: '#103A5E', // Marino profundo
    muted: '#B9D9F3', // Cielo suave
    line: '#1D4F7A', // Borde noche
    // §3.1 no define acento ni fondo suave para noche: el coral ya es la marca
    // y la superficie hace de fondo suave.
    accent: '#FF6B57',
    soft: '#103A5E',
  },
};

/** Duraciones en milisegundos (§9.2). */
export const duraciones = {
  instant: 100,
  fast: 160,
  base: 220,
  slow: 320,
  emphasis: 480,
} as const;

export const curvas = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0, 1)',
  exit: 'cubic-bezier(0.3, 0, 1, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/** Variables CSS de un tema: `--color-brand`, `--motion-base`, `--ease-standard`… */
export function variablesCss(tema: Tema): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [nombre, valor] of Object.entries(colores[tema])) {
    variables[`--color-${nombre}`] = valor;
  }
  for (const [nombre, valor] of Object.entries(duraciones)) {
    variables[`--motion-${nombre}`] = `${valor}ms`;
  }
  for (const [nombre, valor] of Object.entries(curvas)) {
    variables[`--ease-${nombre}`] = valor;
  }
  return variables;
}

/** Hoja de estilos con el tema claro en `:root` y el noche en `[data-tema='noche']`. */
export function hojaDeEstilos(): string {
  const bloque = (selector: string, tema: Tema) =>
    `${selector} {\n${Object.entries(variablesCss(tema))
      .map(([variable, valor]) => `  ${variable}: ${valor};`)
      .join('\n')}\n}`;
  return `${bloque(':root', 'claro')}\n\n${bloque("[data-tema='noche']", 'noche')}\n`;
}
