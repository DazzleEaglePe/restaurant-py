import { generateKeyPairSync } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { accessTokenClaimsSchema, type AccessTokenClaims } from '@resto/contracts';
import jwt from 'jsonwebtoken';

import type { Environment } from '../../config/env.schema';
import type { Sesion } from '../../shared/decorators/sesion.decorator';

/** docs/07_SEGURIDAD_AUTH.md §2.2: 15 minutos. */
export const VIGENCIA_ACCESS_TOKEN_S = 15 * 60;
/** Sesión de la consola de plataforma: sin renovación, se vuelve a ingresar. */
export const VIGENCIA_TOKEN_PLATAFORMA_S = 30 * 60;

/** Audiencias distintas: un token de negocio no abre la consola, ni al revés. */
const AUDIENCIA_NEGOCIO = 'resto';
const AUDIENCIA_PLATAFORMA = 'resto-plataforma';

/** Los archivos .env guardan el PEM en una línea, con `\n` escritos. */
const pem = (valor: string) => valor.replace(/\\n/g, '\n');

/** Firma y verifica los access tokens (RS256). */
@Injectable()
export class TokensAccesoService {
  private readonly logger = new Logger(TokensAccesoService.name);
  private readonly clavePrivada: string;
  private readonly clavePublica: string;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    const privada = config.get('JWT_PRIVATE_KEY', { infer: true });
    const publica = config.get('JWT_PUBLIC_KEY', { infer: true });
    if (privada && publica) {
      this.clavePrivada = pem(privada);
      this.clavePublica = pem(publica);
      return;
    }
    // El esquema de entorno ya impide llegar aquí en producción.
    this.logger.warn('Sin JWT_PRIVATE_KEY/JWT_PUBLIC_KEY: se usan claves temporales.');
    const par = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    this.clavePrivada = par.privateKey;
    this.clavePublica = par.publicKey;
  }

  firmar(sesion: Sesion): string {
    return jwt.sign(
      { sub: sesion.usuarioId, tid: sesion.tenantId, rol: sesion.rol, loc: sesion.locales },
      this.clavePrivada,
      { algorithm: 'RS256', expiresIn: VIGENCIA_ACCESS_TOKEN_S, audience: AUDIENCIA_NEGOCIO },
    );
  }

  firmarPlataforma(adminId: string): string {
    return jwt.sign({ sub: adminId }, this.clavePrivada, {
      algorithm: 'RS256',
      expiresIn: VIGENCIA_TOKEN_PLATAFORMA_S,
      audience: AUDIENCIA_PLATAFORMA,
    });
  }

  /** Devuelve el id del administrador de plataforma, o `null`. */
  verificarPlataforma(token: string): string | null {
    try {
      const claims = jwt.verify(token, this.clavePublica, {
        algorithms: ['RS256'],
        audience: AUDIENCIA_PLATAFORMA,
      });
      return typeof claims === 'object' && typeof claims.sub === 'string' ? claims.sub : null;
    } catch {
      return null;
    }
  }

  /** Devuelve la sesión del token, o `null` si es inválido, vencido o mal formado. */
  verificar(token: string): Sesion | null {
    let claims: AccessTokenClaims;
    try {
      claims = accessTokenClaimsSchema.parse(
        jwt.verify(token, this.clavePublica, {
          algorithms: ['RS256'],
          audience: AUDIENCIA_NEGOCIO,
        }),
      );
    } catch {
      return null;
    }
    return { usuarioId: claims.sub, tenantId: claims.tid, rol: claims.rol, locales: claims.loc };
  }
}
