'use client';

import { PantallaEstado } from '@resto/ui/componentes';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSesion } from '@/lib/sesion';

/** Con sesión, a los negocios; sin ella, al ingreso. */
export default function Inicio() {
  const { estado } = useSesion();
  const router = useRouter();

  useEffect(() => {
    router.replace(estado.tipo === 'activa' ? '/negocios' : '/ingresar');
  }, [estado, router]);

  return <PantallaEstado mascota="cargando" titulo="Consola" mensaje="Preparando todo…" />;
}
