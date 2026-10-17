import type { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../../config/env.schema';
import type { Sesion } from '../../shared/decorators/sesion.decorator';
import { TokensAccesoService, VIGENCIA_ACCESS_TOKEN_S } from './tokens-acceso.service';

// Sin claves configuradas el servicio genera un par temporal.
const sinClaves = { get: () => undefined } as unknown as ConfigService<Environment, true>;

const sesion: Sesion = {
  usuarioId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  rol: 'CAJERO',
  locales: ['33333333-3333-4333-8333-333333333333'],
};

describe('TokensAccesoService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('firma con RS256 los claims de docs/07 §2.1 y los recupera', () => {
    const servicio = new TokensAccesoService(sinClaves);
    const token = servicio.firmar(sesion);

    expect(jwt.decode(token, { complete: true })?.header.alg).toBe('RS256');
    expect(jwt.decode(token)).toMatchObject({
      sub: sesion.usuarioId,
      tid: sesion.tenantId,
      rol: 'CAJERO',
      loc: sesion.locales,
    });
    expect(servicio.verificar(token)).toEqual(sesion);
  });

  it('vence a los 15 minutos', () => {
    vi.useFakeTimers();
    const servicio = new TokensAccesoService(sinClaves);
    const token = servicio.firmar(sesion);

    vi.advanceTimersByTime((VIGENCIA_ACCESS_TOKEN_S - 1) * 1000);
    expect(servicio.verificar(token)).not.toBeNull();
    vi.advanceTimersByTime(2000);
    expect(servicio.verificar(token)).toBeNull();
  });

  it('rechaza un token alterado', () => {
    const servicio = new TokensAccesoService(sinClaves);
    const [cabecera, , firma] = servicio.firmar(sesion).split('.');
    const otroNegocio = Buffer.from(
      JSON.stringify({ ...(jwt.decode(servicio.firmar(sesion)) as object), tid: sesion.usuarioId }),
    ).toString('base64url');

    expect(servicio.verificar(`${cabecera}.${otroNegocio}.${firma}`)).toBeNull();
  });

  it('rechaza un token firmado con otra clave', () => {
    const token = new TokensAccesoService(sinClaves).firmar(sesion);

    expect(new TokensAccesoService(sinClaves).verificar(token)).toBeNull();
  });

  it('rechaza un token sin el algoritmo esperado', () => {
    const servicio = new TokensAccesoService(sinClaves);
    const sinFirma = jwt.sign({ ...sesion, sub: sesion.usuarioId }, '', { algorithm: 'none' });

    expect(servicio.verificar(sinFirma)).toBeNull();
    expect(servicio.verificar('no-es-un-jwt')).toBeNull();
  });
});
