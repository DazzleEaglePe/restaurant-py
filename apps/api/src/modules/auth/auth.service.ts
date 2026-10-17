import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MeResponse, SesionResponse } from '@resto/contracts';

import type { Environment } from '../../config/env.schema';
import { CorreoService } from '../../infrastructure/correo/correo.service';
import { hashearContrasena, verificarContrasena } from '../../infrastructure/crypto/contrasenas';
import { generarTokenOpaco, hashearTokenOpaco } from '../../infrastructure/crypto/tokens-opacos';
import { PrismaService, type ScopedClient } from '../../infrastructure/database/prisma.service';
import { operaEnTodosLosLocales } from '../../shared/decorators/roles.decorator';
import type { Sesion } from '../../shared/decorators/sesion.decorator';
import { ApiError, noAutenticado } from '../../shared/errors/api-error';
import { correoRecuperacion } from '../correos/plantillas';
import { validarContrasenaNueva } from './politica-contrasenas';
import { TokensAccesoService, VIGENCIA_ACCESS_TOKEN_S } from './tokens-acceso.service';
import { canjearTokenUnUso, crearTokenUnUso } from './tokens-un-uso';

/** docs/07_SEGURIDAD_AUTH.md §2.2 y §2.3. */
export const VIGENCIA_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
export const INTENTOS_MAXIMOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;

/** Hash señuelo: si el correo no existe se verifica contra él, para que el tiempo
 * de respuesta no revele qué correos están registrados. */
let hashSenuelo: Promise<string> | undefined;
const verificarSenuelo = async (password: string) => {
  hashSenuelo ??= hashearContrasena(generarTokenOpaco());
  await verificarContrasena(await hashSenuelo, password);
  return false;
};

const credencialesInvalidas = () => noAutenticado('Correo o contraseña incorrectos.');

const enlaceInvalido = () =>
  new ApiError(
    HttpStatus.BAD_REQUEST,
    'ENLACE_INVALIDO',
    'El enlace venció o ya se usó. Pide uno nuevo.',
  );

export type ResultadoSesion = { respuesta: SesionResponse; refreshToken: string };

type MembresiaConDatos = NonNullable<Awaited<ReturnType<typeof buscarMembresia>>>;

function buscarMembresia(tx: ScopedClient, usuarioId: string, tenantId: string) {
  return tx.membresia.findUnique({
    where: { tenantId_usuarioId: { tenantId, usuarioId } },
    include: {
      usuario: true,
      negocio: true,
      locales: { include: { local: true } },
    },
  });
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokensAccesoService) private readonly tokens: TokensAccesoService,
    @Inject(CorreoService) private readonly correo: CorreoService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  /** RF-AUTH-001 y RF-AUTH-005. */
  async ingresar(email: string, password: string): Promise<ResultadoSesion> {
    // Ingreso: todavía no hay negocio activo (docs/05_MODELO_DATOS.md §4.4).
    const usuario = await this.prisma.withoutTenantScope((tx) =>
      tx.usuario.findUnique({ where: { email } }),
    );
    const ahora = new Date();

    if (usuario?.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
      const segundos = Math.ceil((usuario.bloqueadoHasta.getTime() - ahora.getTime()) / 1000);
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'CUENTA_BLOQUEADA',
        'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.',
        { reintentar_en_s: segundos },
        { 'Retry-After': String(segundos) },
      );
    }

    // La verificación de Argon2 queda fuera de toda transacción: tarda y no
    // debe retener una conexión de la base.
    const valida = usuario?.passwordHash
      ? await verificarContrasena(usuario.passwordHash, password)
      : await verificarSenuelo(password);

    if (!usuario || !valida) {
      if (usuario) await this.registrarIntentoFallido(usuario.id, ahora);
      throw credencialesInvalidas();
    }

    return this.prisma.withoutTenantScope((tx) => this.abrirSesion(tx, usuario.id));
  }

  /**
   * RF-AUTH-006: el invitado define su contraseña y entra. Si algo falla, la
   * transacción se deshace y el enlace sigue sirviendo.
   */
  async aceptarInvitacion(token: string, password: string): Promise<ResultadoSesion> {
    validarContrasenaNueva(password);
    const passwordHash = await hashearContrasena(password);
    return this.prisma.withoutTenantScope(async (tx) => {
      const usuarioId = await canjearTokenUnUso(tx, token, 'INVITACION');
      if (!usuarioId) throw enlaceInvalido();
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
      validarContrasenaNueva(password, usuario.email);
      await tx.usuario.update({ where: { id: usuarioId }, data: { passwordHash } });
      return this.abrirSesion(tx, usuarioId);
    });
  }

  /**
   * RF-AUTH-004: si la cuenta existe y está activa, envía un enlace de 60 min. La
   * respuesta es la misma exista o no, para no revelar qué correos están registrados.
   */
  async olvideContrasena(email: string): Promise<void> {
    const pedido = await this.prisma.withoutTenantScope(async (tx) => {
      const usuario = await tx.usuario.findUnique({ where: { email } });
      if (!usuario?.passwordHash) return null;
      return { usuario, token: await crearTokenUnUso(tx, usuario.id, 'RECUPERACION') };
    });
    if (!pedido) return;
    this.correo.enviarSinEsperar(
      correoRecuperacion({
        para: pedido.usuario.email,
        nombre: pedido.usuario.nombre,
        enlace: `${this.config.get('WEB_URL', { infer: true })}/recuperar?token=${pedido.token}`,
      }),
    );
  }

  /** Define la contraseña nueva, levanta el bloqueo y cierra todas las sesiones. */
  async restablecerContrasena(token: string, password: string): Promise<void> {
    validarContrasenaNueva(password);
    const passwordHash = await hashearContrasena(password);
    await this.prisma.withoutTenantScope(async (tx) => {
      const usuarioId = await canjearTokenUnUso(tx, token, 'RECUPERACION');
      if (!usuarioId) throw enlaceInvalido();
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
      validarContrasenaNueva(password, usuario.email);
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
      });
      // Si alguien más conocía la contraseña anterior, sus sesiones se cierran.
      await tx.refreshToken.updateMany({
        where: { usuarioId, revocadoAt: null },
        data: { revocadoAt: new Date() },
      });
    });
  }

  /** RF-AUTH-002: rota el refresh token; reutilizar uno ya usado revoca su familia. */
  async renovar(refreshToken: string): Promise<ResultadoSesion> {
    const resultado = await this.prisma.withoutTenantScope(async (tx) => {
      const registro = await tx.refreshToken.findUnique({
        where: { tokenHash: hashearTokenOpaco(refreshToken) },
      });
      if (!registro) return { tipo: 'invalido' } as const;

      const ahora = new Date();
      // Reclamo atómico: si dos renovaciones llegan con el mismo token, una gana.
      const reclamado = await tx.refreshToken.updateMany({
        where: { id: registro.id, usadoAt: null, revocadoAt: null, expiraAt: { gt: ahora } },
        data: { usadoAt: ahora },
      });
      if (reclamado.count === 0) {
        if (registro.usadoAt && !registro.revocadoAt) {
          // Alguien guardó un token ya rotado: se cierra la sesión entera.
          await this.revocarFamilia(tx, registro.familiaId, ahora);
          return { tipo: 'reutilizado' } as const;
        }
        return { tipo: 'invalido' } as const;
      }

      const membresia = await buscarMembresia(tx, registro.usuarioId, registro.tenantId);
      if (!membresia?.activa || membresia.negocio.estado !== 'ACTIVO') {
        await this.revocarFamilia(tx, registro.familiaId, ahora);
        return { tipo: 'invalido' } as const;
      }

      const nuevo = await this.crearRefreshToken(
        tx,
        registro.usuarioId,
        registro.tenantId,
        registro.familiaId,
      );
      return {
        tipo: 'ok',
        respuesta: await this.sesionConToken(tx, membresia),
        refreshToken: nuevo,
      } as const;
    });

    if (resultado.tipo === 'reutilizado') {
      throw noAutenticado('Por seguridad cerramos tu sesión. Ingresa de nuevo.');
    }
    if (resultado.tipo === 'invalido') throw noAutenticado('Tu sesión venció. Ingresa de nuevo.');
    return { respuesta: resultado.respuesta, refreshToken: resultado.refreshToken };
  }

  /** RF-AUTH-003: revoca la sesión del token. Repetirlo no tiene efecto. */
  async cerrarSesion(refreshToken: string): Promise<void> {
    await this.prisma.withoutTenantScope(async (tx) => {
      const registro = await tx.refreshToken.findUnique({
        where: { tokenHash: hashearTokenOpaco(refreshToken) },
        select: { familiaId: true },
      });
      if (registro) await this.revocarFamilia(tx, registro.familiaId, new Date());
    });
  }

  /**
   * `POST /v1/auth/switch-tenant`: cierra la sesión actual y abre una en el otro
   * negocio, que debe estar activo y tener al usuario como miembro activo.
   */
  async cambiarNegocio(
    sesion: Sesion,
    refreshToken: string,
    tenantId: string,
  ): Promise<ResultadoSesion> {
    // Recorre dos negocios a la vez: excepción de docs/05_MODELO_DATOS.md §4.4.
    return this.prisma.withoutTenantScope(async (tx) => {
      const actual = await tx.refreshToken.findUnique({
        where: { tokenHash: hashearTokenOpaco(refreshToken) },
      });
      if (!actual || actual.usuarioId !== sesion.usuarioId || actual.revocadoAt || actual.usadoAt) {
        throw noAutenticado('Tu sesión venció. Ingresa de nuevo.');
      }
      const membresia = await buscarMembresia(tx, sesion.usuarioId, tenantId);
      if (!membresia?.activa || membresia.negocio.estado !== 'ACTIVO') {
        throw new ApiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'No tienes acceso a ese negocio.');
      }
      await this.revocarFamilia(tx, actual.familiaId, new Date());
      const nuevo = await this.crearRefreshToken(tx, sesion.usuarioId, tenantId, randomUUID());
      return { respuesta: await this.sesionConToken(tx, membresia), refreshToken: nuevo };
    });
  }

  /** `GET /v1/me`: el negocio sale del token y RLS limita la consulta a él. */
  async yo(sesion: Sesion): Promise<MeResponse> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      const membresia = await buscarMembresia(tx, sesion.usuarioId, sesion.tenantId);
      if (!membresia?.activa || membresia.negocio.estado !== 'ACTIVO') throw noAutenticado();
      return this.describirSesion(tx, membresia);
    });
  }

  /** Abre una sesión en el negocio más antiguo del usuario; `switch-tenant` cambia a otro. */
  private async abrirSesion(tx: ScopedClient, usuarioId: string): Promise<ResultadoSesion> {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
    const primera = await tx.membresia.findFirst({
      where: { usuarioId, activa: true, negocio: { estado: 'ACTIVO' } },
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true },
    });
    const membresia = primera && (await buscarMembresia(tx, usuarioId, primera.tenantId));
    if (!membresia) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        'Tu usuario no tiene acceso a ningún negocio activo.',
      );
    }
    const refreshToken = await this.crearRefreshToken(
      tx,
      usuarioId,
      membresia.tenantId,
      randomUUID(),
    );
    return { respuesta: await this.sesionConToken(tx, membresia), refreshToken };
  }

  private async registrarIntentoFallido(usuarioId: string, ahora: Date): Promise<void> {
    await this.prisma.withoutTenantScope(async (tx) => {
      const { intentosFallidos } = await tx.usuario.update({
        where: { id: usuarioId },
        data: { intentosFallidos: { increment: 1 } },
        select: { intentosFallidos: true },
      });
      if (intentosFallidos >= INTENTOS_MAXIMOS) {
        await tx.usuario.update({
          where: { id: usuarioId },
          data: { intentosFallidos: 0, bloqueadoHasta: new Date(ahora.getTime() + BLOQUEO_MS) },
        });
      }
    });
  }

  private async crearRefreshToken(
    tx: ScopedClient,
    usuarioId: string,
    tenantId: string,
    familiaId: string,
  ): Promise<string> {
    const token = generarTokenOpaco();
    await tx.refreshToken.create({
      data: {
        usuarioId,
        tenantId,
        familiaId,
        tokenHash: hashearTokenOpaco(token),
        expiraAt: new Date(Date.now() + VIGENCIA_REFRESH_MS),
      },
    });
    return token;
  }

  private async revocarFamilia(tx: ScopedClient, familiaId: string, ahora: Date): Promise<void> {
    await tx.refreshToken.updateMany({
      where: { familiaId, revocadoAt: null },
      data: { revocadoAt: ahora },
    });
  }

  private async describirSesion(
    tx: ScopedClient,
    membresia: MembresiaConDatos,
  ): Promise<MeResponse> {
    const locales = operaEnTodosLosLocales(membresia.rol)
      ? await tx.local.findMany({
          // El filtro por negocio es explícito: en el ingreso no hay contexto de RLS.
          where: { tenantId: membresia.tenantId, activo: true },
          orderBy: { nombre: 'asc' },
        })
      : membresia.locales
          .map((asignado) => asignado.local)
          .filter((local) => local.activo)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return {
      user: {
        id: membresia.usuario.id,
        nombre: membresia.usuario.nombre,
        email: membresia.usuario.email,
      },
      tenant: { id: membresia.negocio.id, nombre_comercial: membresia.negocio.nombreComercial },
      rol: membresia.rol,
      locales: locales.map((local) => ({ id: local.id, nombre: local.nombre })),
    };
  }

  private async sesionConToken(
    tx: ScopedClient,
    membresia: MembresiaConDatos,
  ): Promise<SesionResponse> {
    const datos = await this.describirSesion(tx, membresia);
    const accessToken = this.tokens.firmar({
      usuarioId: datos.user.id,
      tenantId: datos.tenant.id,
      rol: datos.rol,
      // docs/07 §2.1: vacío significa «todos los locales».
      locales: operaEnTodosLosLocales(datos.rol) ? [] : datos.locales.map((l) => l.id),
    });
    return { ...datos, access_token: accessToken, expires_in: VIGENCIA_ACCESS_TOKEN_S };
  }
}
