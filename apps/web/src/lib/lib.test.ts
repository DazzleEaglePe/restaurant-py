import { ErrorApi } from '@resto/api-client';
import { describe, expect, it } from 'vitest';

import { destinoInicial, localOperativo } from './destinos';
import { mensajeDeError } from './errores';

const centro = { id: 'centro', nombre: 'Centro' };
const norte = { id: 'norte', nombre: 'Norte' };

describe('destinoInicial', () => {
  it('OWNER y ADMIN van a la administración', () => {
    expect(destinoInicial({ rol: 'OWNER', locales: [centro, norte] })).toBe('/admin');
    expect(destinoInicial({ rol: 'ADMIN', locales: [] })).toBe('/admin');
  });

  it('una cajera con un local va directo a la caja', () => {
    expect(destinoInicial({ rol: 'CAJERO', locales: [centro] })).toBe('/caja');
  });

  it('con varios locales elige primero, salvo que ya haya elegido', () => {
    expect(destinoInicial({ rol: 'CAJERO', locales: [centro, norte] })).toBe(
      '/elegir-local?siguiente=/caja',
    );
    expect(destinoInicial({ rol: 'CAJERO', locales: [centro, norte] }, 'norte')).toBe('/caja');
    expect(destinoInicial({ rol: 'MESERO', locales: [centro, norte] }, 'otro')).toBe(
      '/elegir-local?siguiente=/salon',
    );
  });

  it('sin locales asignados no puede operar', () => {
    expect(destinoInicial({ rol: 'MESERO', locales: [] })).toBe('/sin-local');
  });
});

describe('localOperativo', () => {
  it('usa el guardado si sigue asignado, o el único', () => {
    expect(localOperativo({ rol: 'CAJERO', locales: [centro, norte] }, 'norte')).toBe('norte');
    expect(localOperativo({ rol: 'CAJERO', locales: [centro] }, 'quitado')).toBe('centro');
    expect(localOperativo({ rol: 'CAJERO', locales: [centro, norte] }, null)).toBeNull();
  });
});

describe('mensajeDeError', () => {
  it('dice cuántos minutos falta para desbloquear la cuenta', () => {
    const error = new ErrorApi(429, 'CUENTA_BLOQUEADA', 'x', { reintentar_en_s: 600 });
    expect(mensajeDeError(error)).toMatch(/10 minutos/);
    expect(
      mensajeDeError(new ErrorApi(429, 'CUENTA_BLOQUEADA', 'x', { reintentar_en_s: 30 })),
    ).toMatch(/1 minuto /);
  });

  it('usa el mensaje de la API en los demás casos', () => {
    expect(
      mensajeDeError(new ErrorApi(401, 'UNAUTHENTICATED', 'Correo o contraseña incorrectos.')),
    ).toBe('Correo o contraseña incorrectos.');
  });

  it('sin respuesta de la API, pide revisar el internet', () => {
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toMatch(/internet/);
  });
});
