'use client';

import { Boton, Mascota } from '@resto/ui/componentes';
import type { ReactNode } from 'react';

import { ConSesion, useSesion } from '@/lib/sesion';

/** Marco de la consola: quién ingresó y «Salir». */
export default function LayoutConsola({ children }: { children: ReactNode }) {
  const { salir } = useSesion();

  return (
    <ConSesion>
      {(sesion) => (
        <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6">
          <header className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Mascota estado="listo" tamano={44} />
              <div className="min-w-0">
                <p className="text-sm text-muted">Consola de plataforma</p>
                <p className="truncate font-titulo text-xl text-ink">{sesion.admin.nombre}</p>
              </div>
            </div>
            <Boton variante="fantasma" className="min-h-10 px-3" onClick={salir}>
              Salir
            </Boton>
          </header>
          <main className="flex flex-col gap-5">{children}</main>
        </div>
      )}
    </ConSesion>
  );
}
