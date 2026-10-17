import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { MeResponse, RolUsuario, SesionResponse } from '@resto/contracts';

import { hashearContrasena, verificarContrasena } from '../../infrastructure/crypto/contrasenas';
import { generarTokenOpaco, hashearTokenOpaco } from '../../infrastructure/crypto/tokens-opacos';
import { PrismaService, type ScopedClient } from '../../infrastructure/database/prisma.service';
import type { Sesion } from '../../shared/decorators/sesion.decorator';
import { ApiError, noAutenticado } from '../../shared/errors/api-error';
import { TokensAccesoService, VIGENCIA_ACCESS_TOKEN_S } from './tokens-acceso.service';

/** docs/07_SEGURIDAD_AUTH.md §2.2 y §2.3. */
export const VIGENCIA_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
export const INTENTOS_MAXIMOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;

const ROLES_TODOS_LOS_LOCALES: ReadonlySet<RolUsuario> = new Set(['OWNER', 'ADMIN']);

/** Hash señuelo: si el correo no existe se verifica contra él, para que el tiempo
 * de respuesta no revele qué correos están registrados. */
let hashSenuelo: Promise<string> | undefined;
const verificarSenuelo = async (password: string) => {
  hashSenuelo ??= hashearContrasena(generarTokenOpaco());
  await verificarContrasena(await hashSenuelo, password);
  return false;
};

const credencialesInvalidas = () => noAutenticado('Correo o contraseña incorrectos.');

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

    return this.prisma.withoutTenantScope(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: 0, bloqueadoHasta: null },
      });
      // Con varios negocios entra al más antiguo; `switch-tenant` (#8) cambia de negocio.
      const primera = await tx.membresia.findFirst({
        where: { usuarioId: usuario.id, activa: true, negocio: { estado: 'ACTIVO' } },
        orderBy: { createdAt: 'asc' },
        select: { tenantId: true },
      });
      const membresia = primera && (await buscarMembresia(tx, usuario.id, primera.tenantId));
      if (!membresia) {
        throw new ApiError(
          HttpStatus.FORBIDDEN,
          'FORBIDDEN',
          'Tu usuario no tiene acceso a ningún negocio activo.',
        );
      }
      const refreshToken = await this.crearRefreshToken(
        tx,
        usuario.id,
        membresia.tenantId,
        randomUUID(),
      );
      return { respuesta: await this.sesionConToken(tx, membresia), refreshToken };
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

  /** `GET /v1/me`: el negocio sale del token y RLS limita la consulta a él. */
  async yo(sesion: Sesion): Promise<MeResponse> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      const membresia = await buscarMembresia(tx, sesion.usuarioId, sesion.tenantId);
      if (!membresia?.activa || membresia.negocio.estado !== 'ACTIVO') throw noAutenticado();
      return this.describirSesion(tx, membresia);
    });
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
    const locales = ROLES_TODOS_LOS_LOCALES.has(membresia.rol)
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
      locales: ROLES_TODOS_LOS_LOCALES.has(datos.rol) ? [] : datos.locales.map((l) => l.id),
    });
    return { ...datos, access_token: accessToken, expires_in: VIGENCIA_ACCESS_TOKEN_S };
  }
}
