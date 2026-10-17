'use client';

import { ConSesion } from '@/lib/sesion';

import { Superficie } from '../superficie';

export default function Caja() {
  return (
    <ConSesion roles={['OWNER', 'ADMIN', 'CAJERO']}>
      {(sesion) => (
        <Superficie
          sesion={sesion}
          titulo="Caja"
          proximamente="Aquí abrirás tu turno y tomarás pedidos desde el Sprint 3."
        />
      )}
    </ConSesion>
  );
}
