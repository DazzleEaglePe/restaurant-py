import { Mascota } from '@resto/ui/componentes';
import type { ReactNode } from 'react';

/** Marco de ingreso, activación y recuperación: pensado para el celular. */
export default function LayoutAuth({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
        <Mascota estado="listo" tamano={56} />
        <p className="font-titulo text-3xl text-brand">resto</p>
      </header>
      {children}
    </main>
  );
}
