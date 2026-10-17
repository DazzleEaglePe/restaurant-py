'use client';

import { Boton, Mascota } from '@resto/ui/componentes';
import { cn } from '@resto/ui/cn';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { ConSesion, useSesion } from '@/lib/sesion';
import { SesionAdmin } from '@/lib/sesion-admin';

const SECCIONES = [
  { href: '/admin', texto: 'Inicio' },
  { href: '/admin/locales', texto: 'Locales' },
  { href: '/admin/equipo', texto: 'Equipo' },
  { href: '/admin/negocio', texto: 'Negocio' },
] as const;

/**
 * Administración (docs/08_UX_FLUJOS.md §2.4). Se usa sobre todo desde el celular
 * del dueño al cierre del día (D14), así que la navegación es una fila de pestañas
 * que se desplaza.
 */
export default function LayoutAdmin({ children }: { children: ReactNode }) {
  const { salir } = useSesion();
  const router = useRouter();
  const ruta = usePathname();

  return (
    <ConSesion roles={['OWNER', 'ADMIN']}>
      {(sesion) => (
        <SesionAdmin.Provider value={sesion}>
          <div className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-5 px-4 py-5 sm:px-6">
            <header className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Mascota estado="listo" tamano={44} />
                <div className="min-w-0">
                  <p className="text-sm text-muted">Administración</p>
                  <p className="truncate font-titulo text-xl text-ink">
                    {sesion.tenant.nombre_comercial}
                  </p>
                </div>
              </div>
              <Boton
                variante="fantasma"
                className="min-h-10 px-3"
                onClick={async () => {
                  await salir();
                  router.replace('/ingresar');
                }}
              >
                Salir
              </Boton>
            </header>
            <nav aria-label="Secciones" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <ul className="flex gap-1.5 sm:gap-2">
                {SECCIONES.map((seccion) => {
                  const activa =
                    seccion.href === '/admin' ? ruta === '/admin' : ruta.startsWith(seccion.href);
                  return (
                    <li key={seccion.href}>
                      <Link
                        href={seccion.href}
                        aria-current={activa ? 'page' : undefined}
                        className={cn(
                          'inline-flex min-h-10 items-center rounded-full px-3 font-bold sm:px-4 whitespace-nowrap transition-colors duration-fast',
                          activa ? 'bg-brand text-white' : 'bg-surface text-ink hover:bg-soft',
                        )}
                      >
                        {seccion.texto}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <main className="flex flex-col gap-5">{children}</main>
          </div>
        </SesionAdmin.Provider>
      )}
    </ConSesion>
  );
}
