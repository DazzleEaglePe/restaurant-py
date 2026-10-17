'use client';

import { PantallaEstado } from '@resto/ui/componentes';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { destinoInicial } from '@/lib/destinos';
import { leerLocal } from '@/lib/local';
import { useSesion } from '@/lib/sesion';

/** Reparte a cada persona a su superficie según su rol. */
export default function Inicio() {
  const { estado } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (estado.tipo === 'anonima') router.replace('/ingresar');
    if (estado.tipo === 'vencida') router.replace('/sesion-vencida');
    if (estado.tipo === 'activa') {
      router.replace(destinoInicial(estado.sesion, leerLocal(estado.sesion.user.id)));
    }
  }, [estado, router]);

  return <PantallaEstado mascota="cargando" titulo="resto" mensaje="Preparando todo…" />;
}
