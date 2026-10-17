'use client';

import { Boton, PantallaEstado } from '@resto/ui/componentes';
import { useRouter } from 'next/navigation';

import { ConSesion, useSesion } from '@/lib/sesion';

/** Una cajera o mesera sin locales asignados todavía no puede operar. */
export default function SinLocal() {
  const { salir } = useSesion();
  const router = useRouter();

  return (
    <ConSesion roles={['CAJERO', 'MESERO']}>
      {() => (
        <PantallaEstado
          mascota="reposo"
          titulo="Aún no tienes un local asignado"
          mensaje="Pide a la administración que te asigne el local donde trabajas."
        >
          <Boton
            variante="secundario"
            onClick={async () => {
              await salir();
              router.replace('/ingresar');
            }}
          >
            Salir
          </Boton>
        </PantallaEstado>
      )}
    </ConSesion>
  );
}
