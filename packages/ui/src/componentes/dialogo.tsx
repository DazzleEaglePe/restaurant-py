'use client';

import { type ReactNode, useEffect, useRef } from 'react';

/**
 * Diálogo modal con `<dialog>` nativo: atrapa el foco, cierra con Escape y
 * aparece con fundido y escala de 96 % a 100 % (docs/09_DESIGN_SYSTEM.md §9.3).
 */
export function Dialogo({
  abierto,
  titulo,
  alCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
}) {
  const referencia = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={referencia}
      onClose={alCerrar}
      aria-labelledby="dialogo-titulo"
      className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-[rgba(11,37,64,0.45)] motion-safe:open:animate-dialogo"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id="dialogo-titulo" className="font-titulo text-xl">
          {titulo}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
