'use client';

import { Tarjeta } from '@resto/ui/componentes';
import { cn } from '@resto/ui/cn';
import Link from 'next/link';

import { api } from '@/lib/api';
import { useCarga } from '@/lib/carga';
import { useSesionAdmin } from '@/lib/sesion-admin';

type Paso = { titulo: string; detalle: string; hecho: boolean; enlace?: string; cuando?: string };

/** Lista de puesta en marcha (docs/08_UX_FLUJOS.md §3). */
export default function InicioAdmin() {
  const sesion = useSesionAdmin();
  const { datos } = useCarga(async () => {
    const [locales, equipo, productos] = await Promise.all([
      api.locales.listar(),
      api.usuarios.listar(),
      api.productos.listar(),
    ]);
    return { locales, equipo, productos };
  });

  const pasos: Paso[] = [
    {
      titulo: 'Activa tu cuenta',
      detalle: 'Ya entraste con tu contraseña.',
      hecho: true,
    },
    {
      titulo: 'Crea tus locales',
      detalle: datos?.locales.length
        ? `${datos.locales.length} ${datos.locales.length === 1 ? 'local creado' : 'locales creados'}.`
        : 'Agrega cada local donde atiendes.',
      hecho: Boolean(datos?.locales.length),
      enlace: '/admin/locales',
    },
    {
      titulo: 'Invita a tu equipo',
      detalle: datos?.equipo.length
        ? `${datos.equipo.length} ${datos.equipo.length === 1 ? 'persona' : 'personas'} en el equipo.`
        : 'Cajeras, meseras y administradores.',
      hecho: (datos?.equipo.length ?? 0) > 1,
      enlace: '/admin/equipo',
    },
    {
      titulo: 'Carga tu carta',
      detalle: datos?.productos.length
        ? `${datos.productos.length} ${datos.productos.length === 1 ? 'producto' : 'productos'} en la carta.`
        : 'Categorías, productos y combos.',
      hecho: Boolean(datos?.productos.length),
      enlace: '/admin/carta',
    },
    {
      titulo: 'Conecta Yallegó',
      detalle: 'Para validar cada Yape al instante.',
      hecho: false,
      cuando: 'Sprint 4',
    },
    {
      titulo: 'Vincula la cocina y la pantalla pública',
      detalle: 'Escaneando el código que muestra cada pantalla.',
      hecho: false,
      cuando: 'Sprint 5',
    },
  ];
  const hechos = pasos.filter((paso) => paso.hecho).length;

  return (
    <>
      <div>
        <h1 className="font-titulo text-2xl text-ink">Hola, {sesion.user.nombre}</h1>
        <p className="text-muted">
          Puesta en marcha: {hechos} de {pasos.length} pasos.
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={hechos}
        aria-valuemin={0}
        aria-valuemax={pasos.length}
        aria-label="Avance de la puesta en marcha"
        className="h-2 overflow-hidden rounded-full bg-soft"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-slow ease-standard"
          style={{ width: `${(hechos / pasos.length) * 100}%` }}
        />
      </div>
      <ol className="flex flex-col gap-3">
        {pasos.map((paso, indice) => {
          const contenido = (
            <Tarjeta className="flex items-center gap-4 p-4">
              <span
                aria-hidden
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full font-bold',
                  paso.hecho ? 'bg-brand text-white' : 'bg-soft text-muted',
                )}
              >
                {paso.hecho ? '✓' : indice + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold text-ink">{paso.titulo}</span>
                <span className="text-sm text-muted">{paso.detalle}</span>
              </span>
              {paso.cuando ? (
                <span className="text-xs font-bold text-muted uppercase">{paso.cuando}</span>
              ) : (
                paso.enlace && (
                  <span aria-hidden className="text-brand">
                    →
                  </span>
                )
              )}
            </Tarjeta>
          );
          return (
            <li key={paso.titulo}>
              {paso.enlace ? (
                <Link href={paso.enlace} className="block rounded-2xl">
                  {contenido}
                </Link>
              ) : (
                contenido
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
