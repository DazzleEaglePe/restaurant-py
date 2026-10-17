import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { EditarMiembro, InvitarMiembro, Miembro, RolUsuario } from '@resto/contracts';

import type { Environment } from '../../config/env.schema';
import { CorreoService, type Correo } from '../../infrastructure/correo/correo.service';
import { PrismaService, type ScopedClient } from '../../infrastructure/database/prisma.service';
import { operaEnTodosLosLocales } from '../../shared/decorators/roles.decorator';
import type { Sesion } from '../../shared/decorators/sesion.decorator';
import { ApiError } from '../../shared/errors/api-error';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { crearTokenUnUso } from '../auth/tokens-un-uso';
import { correoAgregado, correoInvitacion } from '../correos/plantillas';

const ORDEN_ROLES: Record<RolUsuario, number> = { OWNER: 0, ADMIN: 1, CAJERO: 2, MESERO: 3 };

const prohibido = (message: string) => new ApiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);

const yaEsMiembro = () =>
  new ApiError(HttpStatus.CONFLICT, 'YA_ES_MIEMBRO', 'Esa persona ya es parte del equipo.');

function buscarMiembro(tx: ScopedClient, usuarioId: string) {
  return tx.membresia.findFirst({
    where: { usuarioId },
    include: { usuario: true, locales: { include: { local: true } } },
  });
}

type MembresiaConDatos = NonNullable<Awaited<ReturnType<typeof buscarMiembro>>>;

function aMiembro(membresia: MembresiaConDatos): Miembro {
  return {
    id: membresia.usuario.id,
    nombre: membresia.usuario.nombre,
    email: membresia.usuario.email,
    rol: membresia.rol,
    activa: membresia.activa,
    locales: membresia.locales
      .map(({ local }) => ({ id: local.id, nombre: local.nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    invitacion_pendiente: membresia.usuario.passwordHash === null,
  };
}

/** Equipo del negocio (docs/06_API_CONTRACT.md §4). Todo corre con `withTenant`. */
@Injectable()
export class UsuariosService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditoriaService) private readonly auditoria: AuditoriaService,
    @Inject(CorreoService) private readonly correo: CorreoService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  /**
   * `POST /v1/usuarios/invitaciones`. Una cuenta nueva recibe un enlace de 72 h
   * para crear su contraseña; una cuenta que ya existe en otro negocio queda
   * agregada y recibe un aviso. El correo sale después de confirmar la transacción.
   */
  async invitar(sesion: Sesion, datos: InvitarMiembro): Promise<Miembro> {
    if (datos.rol === 'OWNER' && sesion.rol !== 'OWNER') {
      throw prohibido('Solo un dueño puede nombrar a otro dueño.');
    }
    const localIds = operaEnTodosLosLocales(datos.rol) ? [] : [...new Set(datos.local_ids)];
    const webUrl = this.config.get('WEB_URL', { infer: true });

    const { miembro, correo } = await this.prisma
      .withTenant(sesion.tenantId, async (tx) => {
        await this.validarLocales(tx, datos.rol, localIds);
        const negocio = await tx.negocio.findUniqueOrThrow({ where: { id: sesion.tenantId } });

        // `usuarios` no tiene tenant_id: una persona puede estar en varios negocios.
        const existente = await tx.usuario.findUnique({ where: { email: datos.email } });
        if (existente) {
          const yaEsta = await tx.membresia.count({ where: { usuarioId: existente.id } });
          if (yaEsta) throw yaEsMiembro();
        }
        const usuario =
          existente ??
          (await tx.usuario.create({ data: { email: datos.email, nombre: datos.nombre } }));

        const membresia = await tx.membresia.create({
          data: { tenantId: sesion.tenantId, usuarioId: usuario.id, rol: datos.rol },
        });
        await tx.membresiaLocal.createMany({
          data: localIds.map((localId) => ({
            membresiaId: membresia.id,
            localId,
            tenantId: sesion.tenantId,
          })),
        });

        let correo: Correo;
        if (usuario.passwordHash) {
          correo = correoAgregado({
            para: usuario.email,
            nombre: usuario.nombre,
            negocio: negocio.nombreComercial,
            enlace: `${webUrl}/ingresar`,
          });
        } else {
          const token = await crearTokenUnUso(tx, usuario.id, 'INVITACION');
          correo = correoInvitacion({
            para: usuario.email,
            nombre: usuario.nombre,
            negocio: negocio.nombreComercial,
            enlace: `${webUrl}/activar?token=${token}`,
          });
        }

        await this.auditoria.registrar(tx, {
          tenantId: sesion.tenantId,
          accion: 'usuarios.invitado',
          actorTipo: 'USUARIO',
          actorId: sesion.usuarioId,
          recursoTipo: 'usuario',
          recursoId: usuario.id,
          datos: { rol: datos.rol, locales: localIds, cuenta_existente: Boolean(existente) },
        });
        return { miembro: aMiembro((await buscarMiembro(tx, usuario.id))!), correo };
      })
      .catch((error: unknown) => {
        // Dos invitaciones simultáneas al mismo correo: la segunda choca con el único.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw yaEsMiembro();
        }
        throw error;
      });

    this.correo.enviarSinEsperar(correo);
    return miembro;
  }

  /** `POST /v1/usuarios/{id}/invitacion`: un enlace nuevo; el anterior deja de servir. */
  async reenviarInvitacion(sesion: Sesion, usuarioId: string): Promise<void> {
    const webUrl = this.config.get('WEB_URL', { infer: true });
    const correo = await this.prisma.withTenant(sesion.tenantId, async (tx) => {
      const membresia = await buscarMiembro(tx, usuarioId);
      if (!membresia) {
        throw new ApiError(
          HttpStatus.NOT_FOUND,
          'NOT_FOUND',
          'Esa persona no es parte del equipo.',
        );
      }
      if (membresia.rol === 'OWNER' && sesion.rol !== 'OWNER') {
        throw prohibido('Solo un dueño puede invitar a otro dueño.');
      }
      if (membresia.usuario.passwordHash) {
        throw new ApiError(
          HttpStatus.CONFLICT,
          'INVITACION_YA_ACEPTADA',
          'Esa persona ya activó su cuenta.',
        );
      }
      const negocio = await tx.negocio.findUniqueOrThrow({ where: { id: sesion.tenantId } });
      const token = await crearTokenUnUso(tx, usuarioId, 'INVITACION');
      await this.auditoria.registrar(tx, {
        tenantId: sesion.tenantId,
        accion: 'usuarios.invitacion_reenviada',
        actorTipo: 'USUARIO',
        actorId: sesion.usuarioId,
        recursoTipo: 'usuario',
        recursoId: usuarioId,
      });
      return correoInvitacion({
        para: membresia.usuario.email,
        nombre: membresia.usuario.nombre,
        negocio: negocio.nombreComercial,
        enlace: `${webUrl}/activar?token=${token}`,
      });
    });
    this.correo.enviarSinEsperar(correo);
  }

  listar(sesion: Sesion): Promise<Miembro[]> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      const membresias = await tx.membresia.findMany({
        include: { usuario: true, locales: { include: { local: true } } },
      });
      return membresias
        .map(aMiembro)
        .sort(
          (a, b) => ORDEN_ROLES[a.rol] - ORDEN_ROLES[b.rol] || a.nombre.localeCompare(b.nombre),
        );
    });
  }

  editar(sesion: Sesion, usuarioId: string, cambios: EditarMiembro): Promise<Miembro> {
    if (usuarioId === sesion.usuarioId) {
      // También garantiza que el negocio nunca se quede sin dueño: un OWNER solo
      // puede degradar a otro OWNER, así que siempre queda al menos uno.
      throw prohibido('No puedes cambiar tu propio rol ni desactivarte.');
    }

    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      // RLS limita la búsqueda al negocio de la sesión.
      const actual = await buscarMiembro(tx, usuarioId);
      if (!actual) {
        throw new ApiError(
          HttpStatus.NOT_FOUND,
          'NOT_FOUND',
          'Esa persona no es parte del equipo.',
        );
      }
      if ((actual.rol === 'OWNER' || cambios.rol === 'OWNER') && sesion.rol !== 'OWNER') {
        throw prohibido('Solo un dueño puede cambiar o nombrar a otro dueño.');
      }

      const rol = cambios.rol ?? actual.rol;
      const localIds = operaEnTodosLosLocales(rol)
        ? []
        : (cambios.local_ids ?? actual.locales.map((asignado) => asignado.localId));
      await this.validarLocales(tx, rol, localIds);

      await tx.membresia.update({
        where: { id: actual.id },
        data: { rol, activa: cambios.activa },
      });
      await tx.membresiaLocal.deleteMany({ where: { membresiaId: actual.id } });
      await tx.membresiaLocal.createMany({
        data: [...new Set(localIds)].map((localId) => ({
          membresiaId: actual.id,
          localId,
          tenantId: sesion.tenantId,
        })),
      });

      // docs/07_SEGURIDAD_AUTH.md §2.1: el siguiente token debe reflejar el cambio.
      await tx.refreshToken.updateMany({
        where: { usuarioId, revocadoAt: null },
        data: { revocadoAt: new Date() },
      });

      const despues = (await buscarMiembro(tx, usuarioId))!;
      await this.auditoria.registrar(tx, {
        tenantId: sesion.tenantId,
        accion: 'usuarios.editado',
        actorTipo: 'USUARIO',
        actorId: sesion.usuarioId,
        recursoTipo: 'usuario',
        recursoId: usuarioId,
        datos: {
          antes: {
            rol: actual.rol,
            activa: actual.activa,
            locales: actual.locales.map((l) => l.localId),
          },
          despues: { rol: despues.rol, activa: despues.activa, locales: [...new Set(localIds)] },
        },
      });
      return aMiembro(despues);
    });
  }

  /** Un CAJERO o MESERO necesita al menos un local, y todos deben ser de este negocio. */
  private async validarLocales(tx: ScopedClient, rol: RolUsuario, localIds: string[]) {
    if (operaEnTodosLosLocales(rol)) return;
    const unicos = [...new Set(localIds)];
    if (unicos.length === 0) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Asigna al menos un local a un cajero o mesero.',
      );
    }
    const encontrados = await tx.local.count({ where: { id: { in: unicos } } });
    if (encontrados !== unicos.length) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Algún local no existe.');
    }
  }
}
