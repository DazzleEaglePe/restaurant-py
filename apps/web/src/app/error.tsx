'use client';

import { Boton, PantallaEstado } from '@resto/ui/componentes';
import Link from 'next/link';

/** «Algo salió mal» con el código para soporte (docs/09_DESIGN_SYSTEM.md §15). */
export default function ErrorInesperado({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PantallaEstado
      mascota="alerta"
      titulo="Algo salió mal"
      mensaje="No es tu culpa. Intenta de nuevo; si sigue, avisa a soporte con este código."
      codigo={error.digest ?? 'sin código'}
    >
      <Boton onClick={reset}>Reintentar</Boton>
      <Link href="/" className="font-bold text-brand underline-offset-4 hover:underline">
        Ir al inicio
      </Link>
    </PantallaEstado>
  );
}
