'use client';

import { Boton, Mascota, Tarjeta } from '@resto/ui/componentes';
import { useRouter } from 'next/navigation';

import { ConSesion, useSesion } from '@/lib/sesion';

/** Inicio de la administración (docs/08_UX_FLUJOS.md §2.4). */
export default function Administracion() {
  const { salir } = useSesion();
  const router = useRouter();

  return (
    <ConSesion roles={['OWNER', 'ADMIN']}>
      {(sesion) => (
        <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-5 py-8">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mascota estado="listo" tamano={48} />
              <div>
                <p className="text-sm text-muted">Administración</p>
                <h1 className="font-titulo text-2xl text-ink">{sesion.tenant.nombre_comercial}</h1>
              </div>
            </div>
            <Boton
              variante="fantasma"
              onClick={async () => {
                await salir();
                router.replace('/ingresar');
              }}
            >
              Salir
            </Boton>
          </header>
          <Tarjeta>
            <p className="font-bold text-ink">Hola, {sesion.user.nombre}.</p>
            <p className="text-muted">
              Tienes {sesion.locales.length} {sesion.locales.length === 1 ? 'local' : 'locales'}.
            </p>
          </Tarjeta>
        </main>
      )}
    </ConSesion>
  );
}
