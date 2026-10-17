import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CrearNegocioPlataforma, NegocioPlataforma, SesionPlataforma } from '@resto/contracts';

import type { Environment } from '../../config/env.schema';
import { CorreoService, type Correo } from '../../infrastructure/correo/correo.service';
import { Cifrador } from '../../infrastructure/crypto/cifrado';
import { hashearContrasena, verificarContrasena } from '../../infrastructure/crypto/contrasenas';
import { generarTokenOpaco } from '../../infrastructure/crypto/tokens-opacos';
import { verificarTotp } from '../../infrastructure/crypto/totp';
import { PrismaPlataformaService } from '../../infrastructure/database/prisma-plataforma.service';
import { ApiError, noAutenticado } from '../../shared/errors/api-error';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { TokensAccesoService, VIGENCIA_TOKEN_PLATAFORMA_S } from '../auth/tokens-acceso.service';
import { crearTokenUnUso } from '../auth/tokens-un-uso';
import { correoAgregado, correoInvitacion } from '../correos/plantillas';

let hashSenuelo: Promise<string> | undefined;

/** Consola de plataforma (docs/06_API_CONTRACT.md §19, docs/07_SEGURIDAD_AUTH.md §11). */
@Injectable()
export class PlataformaService {
  constructor(
    @Inject(PrismaPlataformaService) private readonly prisma: PrismaPlataformaService,
    @Inject(TokensAccesoService) private readonly tokens: TokensAccesoService,
    @Inject(Cifrador) private readonly cifrador: Cifrador,
    @Inject(AuditoriaService) private readonly auditoria: AuditoriaService,
    @Inject(CorreoService) private readonly correo: CorreoService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  /** Contraseña y TOTP. El mensaje no dice cuál de los dos falló. */
  async ingresar(email: string, password: string, totp: string): Promise<SesionPlataforma> {
    const admin = await this.prisma.administradorPlataforma.findUnique({ where: { email } });
    hashSenuelo ??= hashearContrasena(generarTokenOpaco());
    const contrasenaValida = await verificarContrasena(
      admin?.passwordHash ?? (await hashSenuelo),
      password,
    );
    const valido =
      admin?.activo &&
      contrasenaValida &&
      verificarTotp(this.cifrador.descifrar(admin.totpSecreto), totp);
    if (!admin || !valido) throw noAutenticado('Correo, contraseña o código incorrectos.');

    return {
      access_token: this.tokens.firmarPlataforma(admin.id),
      expires_in: VIGENCIA_TOKEN_PLATAFORMA_S,
      admin: { id: admin.id, nombre: admin.nombre, email: admin.email },
    };
  }

  async listarNegocios(): Promise<NegocioPlataforma[]> {
    const negocios = await this.prisma.negocio.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { locales: true } },
        membresias: { where: { rol: 'OWNER' }, include: { usuario: true } },
      },
    });
    return negocios.map((negocio) => ({
      id: negocio.id,
      nombre_comercial: negocio.nombreComercial,
      estado: negocio.estado,
      locales: negocio._count.locales,
      duenos: negocio.membresias.map(({ usuario }) => ({
        email: usuario.email,
        invitacion_pendiente: usuario.passwordHash === null,
      })),
      created_at: negocio.createdAt.toISOString(),
    }));
  }

  /** RF-PLT-001: negocio, su primer local y la invitación a su OWNER, en una transacción. */
  async crearNegocio(adminId: string, datos: CrearNegocioPlataforma): Promise<NegocioPlataforma> {
    const webUrl = this.config.get('WEB_URL', { infer: true });
    const { negocioId, correo } = await this.prisma.$transaction(async (tx) => {
      const negocio = await tx.negocio.create({
        data: { nombreComercial: datos.nombre_comercial },
      });
      await tx.local.create({ data: { tenantId: negocio.id, nombre: datos.local_inicial } });

      const existente = await tx.usuario.findUnique({ where: { email: datos.owner.email } });
      const usuario =
        existente ??
        (await tx.usuario.create({
          data: { email: datos.owner.email, nombre: datos.owner.nombre },
        }));
      await tx.membresia.create({
        data: { tenantId: negocio.id, usuarioId: usuario.id, rol: 'OWNER' },
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
        tenantId: negocio.id,
        accion: 'negocio.creado',
        actorTipo: 'PLATAFORMA',
        actorId: adminId,
        recursoTipo: 'negocio',
        recursoId: negocio.id,
        datos: { local_inicial: datos.local_inicial, owner: usuario.email },
      });
      return { negocioId: negocio.id, correo };
    });

    this.correo.enviarSinEsperar(correo);
    return (await this.listarNegocios()).find((negocio) => negocio.id === negocioId)!;
  }

  /** RF-PLT-003. Suspender cierra todas las sesiones del negocio. */
  async cambiarEstado(
    adminId: string,
    negocioId: string,
    estado: 'ACTIVO' | 'SUSPENDIDO',
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const actualizados = await tx.negocio.updateMany({
        where: { id: negocioId },
        data: { estado },
      });
      if (actualizados.count === 0) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'No encontramos ese negocio.');
      }
      if (estado === 'SUSPENDIDO') {
        await tx.refreshToken.updateMany({
          where: { tenantId: negocioId, revocadoAt: null },
          data: { revocadoAt: new Date() },
        });
      }
      await this.auditoria.registrar(tx, {
        tenantId: negocioId,
        accion: estado === 'SUSPENDIDO' ? 'negocio.suspendido' : 'negocio.reactivado',
        actorTipo: 'PLATAFORMA',
        actorId: adminId,
        recursoTipo: 'negocio',
        recursoId: negocioId,
      });
    });
  }
}
