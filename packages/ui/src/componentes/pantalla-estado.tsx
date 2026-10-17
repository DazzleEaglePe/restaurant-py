import type { ReactNode } from 'react';

import { type EstadoMascota, Mascota } from './mascota.js';

type Props = {
  mascota: EstadoMascota;
  titulo: string;
  mensaje?: string;
  /** Código para soporte, como el `request_id` o el digest de un error. */
  codigo?: string;
  children?: ReactNode;
};

/** Pantallas de estado del sistema (docs/09_DESIGN_SYSTEM.md §15). */
export function PantallaEstado({ mascota, titulo, mensaje, codigo, children }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center motion-safe:animate-entrada">
      <Mascota estado={mascota} />
      <h1 className="font-titulo text-2xl text-ink">{titulo}</h1>
      {mensaje && <p className="text-muted">{mensaje}</p>}
      {codigo && (
        <p className="rounded-lg bg-soft px-3 py-1 font-mono text-xs text-ink">Código: {codigo}</p>
      )}
      {children && <div className="mt-2 flex w-full flex-col gap-3">{children}</div>}
    </main>
  );
}
