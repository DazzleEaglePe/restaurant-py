'use client';

import type { Local, SesionResponse } from '@resto/contracts';
import { Aviso, Boton, Mascota, Tarjeta } from '@resto/ui/componentes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { localOperativo } from '@/lib/destinos';
import { mensajeDeError } from '@/lib/errores';
import { leerLocal } from '@/lib/local';
import { useSesion } from '@/lib/sesion';

/**
 * Esqueleto de la caja y del salón. Lee el local con `X-Local-Id`
 * (`GET /v1/locales/actual`); el turno y los pedidos llegan en el Sprint 3.
 */
export function Superficie({
  sesion,
  titulo,
  proximamente,
}: {
  sesion: SesionResponse;
  titulo: string;
  proximamente: string;
}) {
  const { salir } = useSesion();
  const router = useRouter();
  const localId = localOperativo(sesion, leerLocal(sesion.user.id));
  const [local, setLocal] = useState<Local | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localId) {
      router.replace('/');
      return;
    }
    api.locales.actual(localId).then(setLocal, (problema) => setError(mensajeDeError(problema)));
  }, [localId, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Mascota estado="listo" tamano={44} />
          <div>
            <p className="text-sm text-muted">{sesion.tenant.nombre_comercial}</p>
            <h1 className="font-titulo text-xl text-ink">
              {titulo} · {local?.nombre ?? '…'}
            </h1>
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

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tarjeta className="flex flex-col gap-2">
        <p className="font-bold text-ink">Hola, {sesion.user.nombre}.</p>
        <p className="text-muted">{proximamente}</p>
        {local && (
          <p className="text-sm text-muted">
            Ventana de pagos del local: {local.ventana_pagos_min} min.
          </p>
        )}
      </Tarjeta>

      {sesion.locales.length > 1 && (
        <Link
          href={`/elegir-local?siguiente=${titulo === 'Salón' ? '/salon' : '/caja'}`}
          className="text-center font-bold text-brand"
        >
          Cambiar de local
        </Link>
      )}
    </main>
  );
}
