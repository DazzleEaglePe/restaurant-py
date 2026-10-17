import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { Environment } from '../../config/env.schema';
import { PlataformaIpGuard } from './plataforma.guards';

const guarda = (ips: string[], entorno: Environment['NODE_ENV'] = 'production') =>
  new PlataformaIpGuard({
    get: (clave: string) => (clave === 'PLATAFORMA_IPS' ? ips : entorno),
  } as unknown as ConfigService<Environment, true>);

const desde = (ip: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ ip }) }) }) as unknown as ExecutionContext;

const permite = (g: PlataformaIpGuard, ip: string) => {
  try {
    return g.canActivate(desde(ip));
  } catch {
    return false;
  }
};

describe('PlataformaIpGuard', () => {
  it('abre solo desde las IPs y subredes permitidas', () => {
    const g = guarda(['10.8.0.0/24', '190.12.3.4']);

    expect(permite(g, '10.8.0.7')).toBe(true);
    expect(permite(g, '::ffff:10.8.0.7')).toBe(true);
    expect(permite(g, '190.12.3.4')).toBe(true);
    expect(permite(g, '10.8.1.7')).toBe(false);
    expect(permite(g, '200.1.1.1')).toBe(false);
    expect(permite(g, '')).toBe(false);
  });

  it('sin lista, en producción no abre y en desarrollo sí', () => {
    expect(permite(guarda([], 'production'), '10.8.0.7')).toBe(false);
    expect(permite(guarda([], 'development'), '10.8.0.7')).toBe(true);
  });

  it('una entrada inválida no deja arrancar', () => {
    expect(() => guarda(['no-es-ip'])).toThrow(/PLATAFORMA_IPS/);
  });
});
