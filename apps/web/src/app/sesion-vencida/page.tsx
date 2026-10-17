import { PantallaEstado } from '@resto/ui/componentes';
import Link from 'next/link';

/** «Tu sesión terminó» (docs/09_DESIGN_SYSTEM.md §15). */
export default function SesionVencida() {
  return (
    <PantallaEstado
      mascota="reposo"
      titulo="Tu sesión terminó"
      mensaje="Ingresa de nuevo para seguir."
    >
      <Link
        href="/ingresar"
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 font-bold text-white"
      >
        Ingresar
      </Link>
    </PantallaEstado>
  );
}
