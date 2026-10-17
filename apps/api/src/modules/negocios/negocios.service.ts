import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CrearLocal, EditarLocal, EditarNegocio, Local, Negocio } from '@resto/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { operaEnTodosLosLocales } from '../../shared/decorators/roles.decorator';
import type { Sesion } from '../../shared/decorators/sesion.decorator';
import { ApiError } from '../../shared/errors/api-error';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { aLocal, aNegocio } from './negocios.mapper';

const noEncontrado = () =>
  new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'No encontramos ese local.');

/** Columnas de Prisma para los campos de la API (snake_case → camelCase). */
function datosLocal(cambios: Partial<CrearLocal & EditarLocal>): Prisma.LocalUpdateInput {
  return {
    nombre: cambios.nombre,
    direccion: cambios.direccion,
    activo: cambios.activo,
    ventanaPagosMin: cambios.ventana_pagos_min,
    permiteConstancia: cambios.permite_constancia,
    montoMaxConstancia: cambios.monto_max_constancia,
    mesaObligatoria: cambios.mesa_obligatoria,
    cocinaAlertaMin: cambios.cocina_alerta_min,
    cocinaCriticoMin: cambios.cocina_critico_min,
    ocultarListosMin: cambios.ocultar_listos_min,
    tiempoBaseMin: cambios.tiempo_base_min,
    costoTaperDefecto: cambios.costo_taper_defecto,
  };
}

/** El nombre del local es único dentro del negocio. */
function traducirDuplicado(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ApiError(HttpStatus.CONFLICT, 'LOCAL_DUPLICADO', 'Ya hay un local con ese nombre.');
  }
  throw error;
}

/** Negocio y locales (docs/06_API_CONTRACT.md §3). Todo corre con `withTenant`. */
@Injectable()
export class NegociosService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditoriaService) private readonly auditoria: AuditoriaService,
  ) {}

  obtenerNegocio(sesion: Sesion): Promise<Negocio> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) =>
      aNegocio(await tx.negocio.findUniqueOrThrow({ where: { id: sesion.tenantId } })),
    );
  }

  editarNegocio(sesion: Sesion, cambios: EditarNegocio): Promise<Negocio> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      const negocio = await tx.negocio.update({
        where: { id: sesion.tenantId },
        data: {
          nombreComercial: cambios.nombre_comercial,
          razonSocial: cambios.razon_social,
          ruc: cambios.ruc,
          logoUrl: cambios.logo_url,
          colorAcento: cambios.color_acento,
        },
      });
      await this.auditoria.registrar(tx, {
        tenantId: sesion.tenantId,
        accion: 'negocio.editado',
        actorTipo: 'USUARIO',
        actorId: sesion.usuarioId,
        recursoTipo: 'negocio',
        recursoId: negocio.id,
        datos: { cambios },
      });
      return aNegocio(negocio);
    });
  }

  /** OWNER y ADMIN ven todos, también los desactivados; el resto, sus locales activos. */
  listarLocales(sesion: Sesion): Promise<Local[]> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      const locales = await tx.local.findMany({
        where: operaEnTodosLosLocales(sesion.rol)
          ? {}
          : {
              activo: true,
              membresiaLocales: { some: { membresia: { usuarioId: sesion.usuarioId } } },
            },
        orderBy: { nombre: 'asc' },
      });
      return locales.map(aLocal);
    });
  }

  crearLocal(sesion: Sesion, datos: CrearLocal): Promise<Local> {
    return this.prisma
      .withTenant(sesion.tenantId, async (tx) => {
        const local = await tx.local.create({
          data: {
            ...(datosLocal(datos) as Prisma.LocalUncheckedCreateInput),
            nombre: datos.nombre,
            tenantId: sesion.tenantId,
          },
        });
        await this.auditoria.registrar(tx, {
          tenantId: sesion.tenantId,
          accion: 'locales.creado',
          actorTipo: 'USUARIO',
          actorId: sesion.usuarioId,
          recursoTipo: 'local',
          recursoId: local.id,
          datos: { nombre: local.nombre },
        });
        return aLocal(local);
      })
      .catch(traducirDuplicado);
  }

  editarLocal(sesion: Sesion, localId: string, cambios: EditarLocal): Promise<Local> {
    return this.prisma
      .withTenant(sesion.tenantId, async (tx) => {
        // RLS deja fuera los locales de otros negocios: para ellos, 404.
        const actualizados = await tx.local.updateMany({
          where: { id: localId },
          data: datosLocal(cambios) as Prisma.LocalUpdateManyMutationInput,
        });
        if (actualizados.count === 0) throw noEncontrado();
        await this.auditoria.registrar(tx, {
          tenantId: sesion.tenantId,
          accion: 'locales.editado',
          actorTipo: 'USUARIO',
          actorId: sesion.usuarioId,
          recursoTipo: 'local',
          recursoId: localId,
          localId,
          datos: { cambios },
        });
        return aLocal(await tx.local.findUniqueOrThrow({ where: { id: localId } }));
      })
      .catch(traducirDuplicado);
  }

  obtenerLocal(sesion: Sesion, localId: string): Promise<Local> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      const local = await tx.local.findUnique({ where: { id: localId } });
      if (!local) throw noEncontrado();
      return aLocal(local);
    });
  }
}
