import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { ScopedClient } from '../../infrastructure/database/prisma.service';

export type RegistroAuditoria = {
  tenantId: string;
  /** Acción del catálogo de docs/07_SEGURIDAD_AUTH.md §10, como `usuarios.editado`. */
  accion: string;
  actorTipo: 'USUARIO' | 'PANTALLA' | 'SISTEMA' | 'PLATAFORMA';
  actorId?: string;
  recursoTipo: string;
  recursoId?: string;
  localId?: string;
  datos?: Prisma.InputJsonObject;
};

/**
 * Registra en la misma transacción que el cambio, para que nunca quede un cambio
 * sin su rastro. La tabla solo admite inserciones (docs/05_MODELO_DATOS.md §4.5).
 */
@Injectable()
export class AuditoriaService {
  async registrar(tx: ScopedClient, registro: RegistroAuditoria): Promise<void> {
    await tx.auditoria.create({
      data: {
        tenantId: registro.tenantId,
        accion: registro.accion,
        actorTipo: registro.actorTipo,
        actorId: registro.actorId,
        recursoTipo: registro.recursoTipo,
        recursoId: registro.recursoId,
        localId: registro.localId,
        datos: registro.datos ?? {},
      },
    });
  }
}
