'use client';

import { Mascota } from '@resto/ui/componentes';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { guardarLocal } from '@/lib/local';
import { ConSesion } from '@/lib/sesion';

/** Quien opera en varios locales elige en cuál está hoy (docs/08_UX_FLUJOS.md §19). */
function ElegirLocal() {
  const router = useRouter();
  const siguiente = useSearchParams().get('siguiente');
  const destino = siguiente === '/salon' ? '/salon' : '/caja';

  return (
    <ConSesion roles={['CAJERO', 'MESERO']}>
      {(sesion) => (
        <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10">
          <header className="flex items-center gap-3">
            <Mascota estado="listo" tamano={56} />
            <div>
              <p className="text-sm text-muted">{sesion.tenant.nombre_comercial}</p>
              <h1 className="font-titulo text-2xl text-ink">¿En qué local estás hoy?</h1>
            </div>
          </header>
          <ul className="flex flex-col gap-3">
            {sesion.locales.map((local) => (
              <li key={local.id}>
                <button
                  type="button"
                  onClick={() => {
                    guardarLocal(sesion.user.id, local.id);
                    router.replace(destino);
                  }}
                  className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-line bg-surface px-5 text-left font-bold text-ink transition-transform duration-instant active:scale-[0.97]"
                >
                  {local.nombre}
                  <span aria-hidden className="text-brand">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </main>
      )}
    </ConSesion>
  );
}

export default function PaginaElegirLocal() {
  return (
    <Suspense>
      <ElegirLocal />
    </Suspense>
  );
}
