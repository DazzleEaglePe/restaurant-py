import { describe, expect, it } from 'vitest';

import {
  MontoInvalidoError,
  aCentimos,
  aMonto,
  calcularVuelto,
  formatearSoles,
  multiplicarCentimos,
  sumarCentimos,
} from './dinero.js';

describe('aCentimos', () => {
  it.each([
    ['25.50', 2550],
    ['25.5', 2550],
    ['25', 2500],
    ['0.01', 1],
    ['0', 0],
    ['-5.00', -500],
    ['-0.00', 0],
    ['99999999.99', 9_999_999_999],
  ])('convierte %s en %i céntimos', (monto, centimos) => {
    expect(aCentimos(monto)).toBe(centimos);
  });

  it.each(['', '25.505', '1,250.00', 'S/ 25.00', '123456789.00', ' 25', 'abc'])(
    'rechaza %j',
    (monto) => {
      expect(() => aCentimos(monto)).toThrow(MontoInvalidoError);
    },
  );

  it('suma sin errores de coma flotante', () => {
    // 0.10 + 0.20 en coma flotante da 0.30000000000000004.
    expect(aMonto(sumarCentimos([aCentimos('0.10'), aCentimos('0.20')]))).toBe('0.30');
  });
});

describe('aMonto', () => {
  it.each([
    [2550, '25.50'],
    [5, '0.05'],
    [0, '0.00'],
    [-150, '-1.50'],
  ])('convierte %i en %s', (centimos, monto) => {
    expect(aMonto(centimos)).toBe(monto);
  });

  it.each([0.5, Number.NaN, Number.POSITIVE_INFINITY, 10_000_000_000])('rechaza %d', (valor) => {
    expect(() => aMonto(valor)).toThrow(MontoInvalidoError);
  });
});

describe('formatearSoles', () => {
  it.each([
    [2550, 'S/ 25.50'],
    [125_000, 'S/ 1,250.00'],
    [123_456_789, 'S/ 1,234,567.89'],
    [-990, '-S/ 9.90'],
  ])('muestra %i como %s', (centimos, texto) => {
    expect(formatearSoles(centimos)).toBe(texto);
  });
});

describe('sumarCentimos', () => {
  it('suma una lista', () => {
    expect(sumarCentimos([2500, 350, 100])).toBe(2950);
  });

  it('una lista vacía suma cero', () => {
    expect(sumarCentimos([])).toBe(0);
  });

  it('rechaza un monto que no es entero', () => {
    expect(() => sumarCentimos([100, 0.5])).toThrow(MontoInvalidoError);
  });
});

describe('multiplicarCentimos', () => {
  it('multiplica por la cantidad', () => {
    expect(multiplicarCentimos(2550, 3)).toBe(7650);
  });

  it.each([-1, 1.5])('rechaza la cantidad %d', (cantidad) => {
    expect(() => multiplicarCentimos(2550, cantidad)).toThrow(RangeError);
  });

  it('rechaza un resultado fuera de numeric(10,2)', () => {
    expect(() => multiplicarCentimos(9_000_000_000, 2)).toThrow(MontoInvalidoError);
  });
});

describe('calcularVuelto', () => {
  it('devuelve el vuelto', () => {
    expect(calcularVuelto(3700, 5000)).toBe(1300);
  });

  it('el pago exacto no tiene vuelto', () => {
    expect(calcularVuelto(3700, 3700)).toBe(0);
  });

  it('devuelve null si lo recibido no alcanza', () => {
    expect(calcularVuelto(3700, 2000)).toBeNull();
  });
});
