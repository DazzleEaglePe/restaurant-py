import { describe, expect, it } from 'vitest';

import { cn } from './lib/cn.js';
import { restoPreset } from './tailwind-preset.js';

describe('cn', () => {
  it('une clases y descarta las falsas', () => {
    const oculto: boolean = false;
    expect(cn('px-2', oculto && 'hidden', 'py-1', undefined)).toBe('px-2 py-1');
  });

  it('la última clase de Tailwind gana', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('restoPreset', () => {
  it('los colores apuntan a variables CSS del tema', () => {
    expect(restoPreset.theme.extend.colors.brand).toBe('var(--color-brand)');
  });

  it('expone las duraciones y curvas de movimiento', () => {
    expect(restoPreset.theme.extend.transitionDuration.base).toBe('var(--motion-base)');
    expect(restoPreset.theme.extend.transitionTimingFunction.standard).toBe('var(--ease-standard)');
  });
});
