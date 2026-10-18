'use client';

import type { LoginPlataforma, SesionPlataforma } from '@resto/contracts';
import { PantallaEstado } from '@resto/ui/componentes';
import { useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { alExpirarSesion, api } from './api';

type EstadoSesion =
  { tipo: 'anonima' } | { tipo: 'vencida' } | { tipo: 'activa'; sesion: SesionPlataforma };

type ValorSesion = {
  estado: EstadoSesion;
  ingresar: (datos: LoginPlataforma) => Promise<SesionPlataforma>;
  salir: () => void;
};

const ContextoSesion = createContext<ValorSesion | null>(null);

/**
 * Sesión de la consola. No se recupera al recargar ni se renueva: el token dura
 * 30 minutos y después se vuelve a ingresar con contraseña y TOTP (docs/07 §11).
 */
export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: 'anonima' });

  useEffect(() => {
    alExpirarSesion(() => setEstado({ tipo: 'vencida' }));
  }, []);

  // Al vencer el token se vuelve al ingreso sin esperar a que falle una acción.
  const vence = estado.tipo === 'activa' ? estado.sesion.expires_in : null;
  useEffect(() => {
    if (vence === null) return;
    const temporizador = setTimeout(() => {
      api.salir();
      setEstado({ tipo: 'vencida' });
    }, vence * 1000);
    return () => clearTimeout(temporizador);
  }, [vence]);

  const ingresar = useCallback(async (datos: LoginPlataforma) => {
    const sesion = await api.ingresar(datos);
    setEstado({ tipo: 'activa', sesion });
    return sesion;
  }, []);

  const salir = useCallback(() => {
    api.salir();
    setEstado({ tipo: 'anonima' });
  }, []);

  const valor = useMemo(() => ({ estado, ingresar, salir }), [estado, ingresar, salir]);
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion fuera de SesionProvider.');
  return valor;
}

/** Muestra el contenido solo con una sesión activa; si no, lleva al ingreso. */
export function ConSesion({ children }: { children: (sesion: SesionPlataforma) => ReactNode }) {
  const { estado } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (estado.tipo !== 'activa') router.replace('/ingresar');
  }, [estado, router]);

  if (estado.tipo !== 'activa') {
    return <PantallaEstado mascota="cargando" titulo="Consola" mensaje="Preparando todo…" />;
  }
  return <>{children(estado.sesion)}</>;
}
