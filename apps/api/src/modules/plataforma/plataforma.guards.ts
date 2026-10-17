import { BlockList, isIP } from 'node:net';

import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { Environment } from '../../config/env.schema';
import { ApiError, noAutenticado } from '../../shared/errors/api-error';
import { TokensAccesoService } from '../auth/tokens-acceso.service';

export type RequestPlataforma = Request & { adminPlataformaId?: string };

/** Convierte `PLATAFORMA_IPS` (IPs sueltas o subredes CIDR) en una lista de permitidas. */
export function crearListaPermitida(entradas: readonly string[]): BlockList {
  const lista = new BlockList();
  for (const entrada of entradas) {
    const [direccion = '', prefijo] = entrada.split('/');
    const tipo = isIP(direccion) === 6 ? 'ipv6' : 'ipv4';
    if (!isIP(direccion)) throw new Error(`PLATAFORMA_IPS tiene una entrada inválida: ${entrada}`);
    if (prefijo === undefined) lista.addAddress(direccion, tipo);
    else lista.addSubnet(direccion, Number(prefijo), tipo);
  }
  return lista;
}

/** Quita el prefijo `::ffff:` con que Node presenta una IPv4 en un socket IPv6. */
const normalizarIp = (ip: string) => (ip.startsWith('::ffff:') ? ip.slice(7) : ip);

/**
 * docs/07_SEGURIDAD_AUTH.md §11: la consola solo se abre desde las IPs de la VPN.
 * Sin lista configurada, en desarrollo se permite todo y en producción, nada.
 */
@Injectable()
export class PlataformaIpGuard implements CanActivate {
  private readonly lista: BlockList | null;
  private readonly produccion: boolean;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    const entradas = config.get('PLATAFORMA_IPS', { infer: true });
    this.lista = entradas.length ? crearListaPermitida(entradas) : null;
    this.produccion = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  canActivate(contexto: ExecutionContext): boolean {
    if (!this.lista) {
      if (!this.produccion) return true;
    } else {
      const ip = normalizarIp(contexto.switchToHttp().getRequest<Request>().ip ?? '');
      const tipo = isIP(ip) === 6 ? 'ipv6' : 'ipv4';
      if (isIP(ip) && this.lista.check(ip, tipo)) return true;
    }
    throw new ApiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'La consola no se abre desde esta red.');
  }
}

/** Exige el token de plataforma, que no sirve en la API de los negocios. */
@Injectable()
export class PlataformaSesionGuard implements CanActivate {
  constructor(@Inject(TokensAccesoService) private readonly tokens: TokensAccesoService) {}

  canActivate(contexto: ExecutionContext): boolean {
    const request = contexto.switchToHttp().getRequest<RequestPlataforma>();
    const [esquema, token] = (request.header('authorization') ?? '').split(' ');
    const adminId = esquema === 'Bearer' && token ? this.tokens.verificarPlataforma(token) : null;
    if (!adminId) throw noAutenticado();
    request.adminPlataformaId = adminId;
    return true;
  }
}
