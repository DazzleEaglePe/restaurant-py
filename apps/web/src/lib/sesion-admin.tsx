'use client';

import type { SesionResponse } from '@resto/contracts';
import { createContext, useContext } from 'react';

export const SesionAdmin = createContext<SesionResponse | null>(null);

/** Sesión de quien administra; solo existe dentro de `/admin`. */
export function useSesionAdmin(): SesionResponse {
  const sesion = useContext(SesionAdmin);
  if (!sesion) throw new Error('useSesionAdmin fuera de la administración.');
  return sesion;
}
