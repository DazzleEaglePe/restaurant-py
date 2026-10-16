import { describe, expect, it } from 'vitest';

import { colores, hojaDeEstilos, variablesCss } from './tokens.js';

describe('temas', () => {
  it('claro y noche definen los mismos tokens', () => {
    expect(Object.keys(colores.noche).sort()).toEqual(Object.keys(colores.claro).sort());
  });

  it('usa los colores de la línea Marino', () => {
    expect(colores.claro.brand).toBe('#0E4C7A');
    expect(colores.noche.bg).toBe('#081C33');
  });
});

describe('variablesCss', () => {
  it('expone colores, duraciones y curvas', () => {
    const variables = variablesCss('claro');

    expect(variables['--color-bg']).toBe('#FFF8F0');
    expect(variables['--motion-base']).toBe('220ms');
    expect(variables['--ease-standard']).toBe('cubic-bezier(0.2, 0, 0, 1)');
  });
});

describe('hojaDeEstilos', () => {
  it('pone el tema claro en :root y el noche en data-tema', () => {
    const css = hojaDeEstilos();

    expect(css).toContain(':root {\n  --color-brand: #0E4C7A;');
    expect(css).toContain("[data-tema='noche'] {\n  --color-brand: #FF6B57;");
  });
});
