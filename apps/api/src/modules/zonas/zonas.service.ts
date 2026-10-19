import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type Zona as ZonaDb } from '@prisma/client';
import type { CrearZona, EditarZona, Zona } from '@resto/contracts';

import { PrismaService, type ScopedClient } from '../../infrastructure/database/prisma.service';
import type { Sesion } from '../../shared/decorators/sesion.decorator';
import { ApiError } from '../../shared/errors/api-error';
import { AuditoriaService } from '../auditoria/auditoria.service';

const aZona = (zona: ZonaDb): Zona => ({
  id: zona.id,
  local_id: zona.localId,
  nombre: zona.nombre,
  piso: zona.piso,
  orden: zona.orden,
  activa: zona.activa,
});

const noEncontrado = (que: string) =>
  new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `No encontramos ${que}.`);

/** El nombre de la zona es único dentro de su local. */
function traducirDuplicado(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ApiError(
      HttpStatus.CONFLICT,
      'ZONA_DUPLICADA',
      'Ese local ya tiene una zona con ese nombre.',
    );
  }
  throw error;
}

const ORDEN = [{ orden: 'asc' }, { nombre: 'asc' }] satisfies Prisma.ZonaOrderByWithRelationInput[];

/** Zonas de cada local (docs/06_API_CONTRACT.md §7, RF-MES-001). */
@Injectable()
export class ZonasService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditoriaService) private readonly auditoria: AuditoriaService,
  ) {}

  /** Las que la caja y el salón ofrecen en su local: solo las activas. */
  activas(sesion: Sesion, localId: string): Promise<Zona[]> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) =>
      (await tx.zona.findMany({ where: { localId, activa: true }, orderBy: ORDEN })).map(aZona),
    );
  }

  /** Todas las del local, también las desactivadas, para la administración. */
  delLocal(sesion: Sesion, localId: string): Promise<Zona[]> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      await this.exigirLocal(tx, localId);
      return (await tx.zona.findMany({ where: { localId }, orderBy: ORDEN })).map(aZona);
    });
  }

  crear(sesion: Sesion, localId: string, datos: CrearZona): Promise<Zona> {
    return this.prisma
      .withTenant(sesion.tenantId, async (tx) => {
        await this.exigirLocal(tx, localId);
        const ultima = await tx.zona.aggregate({ where: { localId }, _max: { orden: true } });
        const zona = await tx.zona.create({
          data: {
            tenantId: sesion.tenantId,
            localId,
            nombre: datos.nombre,
            piso: datos.piso ?? null,
            orden: (ultima._max.orden ?? -1) + 1,
          },
        });
        await this.registrar(tx, sesion, 'zonas.creada', zona.id, localId, { nombre: zona.nombre });
        return aZona(zona);
      })
      .catch(traducirDuplicado);
  }

  editar(sesion: Sesion, id: string, cambios: EditarZona): Promise<Zona> {
    return this.prisma
      .withTenant(sesion.tenantId, async (tx) => {
        const antes = await tx.zona.findUnique({ where: { id } });
        if (!antes) throw noEncontrado('esa zona');
        const zona = await tx.zona.update({
          where: { id },
          data: { nombre: cambios.nombre, piso: cambios.piso, activa: cambios.activa },
        });
        await this.registrar(tx, sesion, 'zonas.editada', id, zona.localId, { cambios });
        return aZona(zona);
      })
      .catch(traducirDuplicado);
  }

  /** Orden por arrastre; los ids deben ser zonas de ese local. */
  ordenar(sesion: Sesion, localId: string, ids: string[]): Promise<Zona[]> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      await this.exigirLocal(tx, localId);
      for (const [orden, id] of ids.entries()) {
        const { count } = await tx.zona.updateMany({ where: { id, localId }, data: { orden } });
        if (count === 0) throw noEncontrado('una de las zonas');
      }
      return (await tx.zona.findMany({ where: { localId }, orderBy: ORDEN })).map(aZona);
    });
  }

  private async exigirLocal(tx: ScopedClient, localId: string): Promise<void> {
    if (!(await tx.local.findUnique({ where: { id: localId } }))) throw noEncontrado('ese local');
  }

  private registrar(
    tx: ScopedClient,
    sesion: Sesion,
    accion: string,
    zonaId: string,
    localId: string,
    datos: Prisma.InputJsonObject,
  ): Promise<void> {
    return this.auditoria.registrar(tx, {
      tenantId: sesion.tenantId,
      accion,
      actorTipo: 'USUARIO',
      actorId: sesion.usuarioId,
      recursoTipo: 'zona',
      recursoId: zonaId,
      localId,
      datos,
    });
  }
}
