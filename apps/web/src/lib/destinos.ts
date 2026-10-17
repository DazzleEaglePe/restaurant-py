import type { SesionResponse } from '@resto/contracts';

type Sesion = Pick<SesionResponse, 'rol' | 'locales'>;

/**
 * A dónde va cada persona al entrar (docs/08_UX_FLUJOS.md §2):
 * OWNER y ADMIN a la administración; CAJERO a la caja y MESERO al salón, pasando
 * por la elección de local si tienen más de uno.
 */
export function destinoInicial(sesion: Sesion, localGuardado?: string | null): string {
  if (sesion.rol === 'OWNER' || sesion.rol === 'ADMIN') return '/admin';
  const superficie = sesion.rol === 'MESERO' ? '/salon' : '/caja';
  if (sesion.locales.length === 0) return '/sin-local';
  const guardadoValido = sesion.locales.some((local) => local.id === localGuardado);
  if (sesion.locales.length === 1 || guardadoValido) return superficie;
  return `/elegir-local?siguiente=${superficie}`;
}

/** El local en el que opera: el elegido, o el único que tiene asignado. */
export function localOperativo(sesion: Sesion, localGuardado?: string | null): string | null {
  if (sesion.locales.some((local) => local.id === localGuardado)) return localGuardado ?? null;
  return sesion.locales.length === 1 ? sesion.locales[0]!.id : null;
}
