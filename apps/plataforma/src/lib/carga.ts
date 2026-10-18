'use client';

import { useCallback, useEffect, useState } from 'react';

import { mensajeDeError } from './errores';

type Carga<T> = {
  datos: T | null;
  error: string | null;
  cargando: boolean;
  recargar: () => Promise<void>;
};

/** Carga datos de la API al abrir la pantalla y permite recargarlos tras un cambio. */
export function useCarga<T>(cargar: () => Promise<T>): Carga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await cargar());
      setError(null);
    } catch (problema) {
      setError(mensajeDeError(problema));
    } finally {
      setCargando(false);
    }
    // Se carga una vez al abrir; `recargar` vuelve a pedir tras un cambio.
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { datos, error, cargando, recargar };
}
