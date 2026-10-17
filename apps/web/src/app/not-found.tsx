import { PantallaEstado } from '@resto/ui/componentes';
import Link from 'next/link';

/** 404 (docs/09_DESIGN_SYSTEM.md §15). */
export default function NoEncontrada() {
  return (
    <PantallaEstado
      mascota="reposo"
      titulo="Esta página no existe"
      mensaje="Puede que el enlace esté incompleto."
    >
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 font-bold text-white"
      >
        Ir al inicio
      </Link>
    </PantallaEstado>
  );
}
