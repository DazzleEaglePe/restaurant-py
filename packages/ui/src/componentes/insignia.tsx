import type { ReactNode } from 'react';

import { cn } from '../lib/cn.js';

type Tono = 'marca' | 'neutro' | 'aviso' | 'apagado';

const ESTILOS: Record<Tono, string> = {
  marca: 'bg-soft text-brand',
  neutro: 'bg-[#F2F4F7] text-ink',
  aviso: 'bg-[#FFFAEB] text-[#93370D]',
  apagado: 'bg-[#F2F4F7] text-muted',
};

/** Etiqueta corta en mayúsculas con espaciado de letras (docs/09 §16). */
export function Insignia({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide',
        ESTILOS[tono],
      )}
    >
      {children}
    </span>
  );
}
