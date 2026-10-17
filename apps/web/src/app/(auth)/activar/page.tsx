'use client';

import { Aviso } from '@resto/ui/componentes';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { api } from '@/lib/api';
import { destinoInicial } from '@/lib/destinos';
import { useSesion } from '@/lib/sesion';

import { NuevaContrasena } from '../nueva-contrasena';

/** RF-AUTH-006: el enlace de la invitación (72 h) trae el token. */
function Activar() {
  const token = useSearchParams().get('token');
  const { establecer } = useSesion();
  const router = useRouter();

  if (!token) {
    return (
      <Aviso tipo="error">
        Este enlace está incompleto. Ábrelo de nuevo desde el correo de invitación.
      </Aviso>
    );
  }

  return (
    <>
      <NuevaContrasena
        titulo="Activa tu cuenta"
        descripcion="Crea la contraseña con la que vas a ingresar."
        accion="Activar mi cuenta"
        alGuardar={async (password) => {
          const sesion = await api.aceptarInvitacion(token, password);
          establecer(sesion);
          router.replace(destinoInicial(sesion));
        }}
      />
      <Link href="/ingresar" className="text-center text-sm font-bold text-brand">
        Ya tengo cuenta
      </Link>
    </>
  );
}

export default function PaginaActivar() {
  return (
    <Suspense>
      <Activar />
    </Suspense>
  );
}
