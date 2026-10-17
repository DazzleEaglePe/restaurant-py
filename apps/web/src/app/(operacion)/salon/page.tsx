'use client';

import { ConSesion } from '@/lib/sesion';

import { Superficie } from '../superficie';

export default function Salon() {
  return (
    <ConSesion roles={['MESERO']}>
      {(sesion) => (
        <Superficie
          sesion={sesion}
          titulo="Salón"
          proximamente="Aquí verás los pedidos para mesa y los marcarás entregados desde el Sprint 5."
        />
      )}
    </ConSesion>
  );
}
