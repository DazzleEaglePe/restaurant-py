import type { ReactNode } from 'react';

import { cn } from '../lib/cn.js';

type Tipo = 'error' | 'info' | 'exito';

const ESTILOS: Record<Tipo, string> = {
  error: 'border-[#FDA29B] bg-[#FEF3F2] text-[#912018]',
  info: 'border-line bg-soft text-ink',
  exito: 'border-[#A6F4C5] bg-[#ECFDF3] text-[#05603A]',
};

/** Aviso en línea. Los errores dicen qué pasó y qué hacer (docs/09 §16). */
export function Aviso({
  tipo = 'info',
  children,
  className,
}: {
  tipo?: Tipo;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={cn('rounded-xl border px-4 py-3 text-sm font-semibold', ESTILOS[tipo], className)}
    >
      {children}
    </div>
  );
}
