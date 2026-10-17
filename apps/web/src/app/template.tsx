import type { ReactNode } from 'react';

/**
 * Se vuelve a montar en cada navegación: la pantalla nueva entra con un fundido
 * y un leve desplazamiento (docs/09_DESIGN_SYSTEM.md §9.3). Con «reducir
 * movimiento» no se anima.
 */
export default function Transicion({ children }: { children: ReactNode }) {
  return <div className="motion-safe:animate-entrada">{children}</div>;
}
