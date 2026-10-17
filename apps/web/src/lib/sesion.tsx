'use client';

import type { RolUsuario, SesionResponse } from '@resto/contracts';
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
  | { tipo: 'cargando' }
  | { tipo: 'anonima' }
  | { tipo: 'vencida' }
  | { tipo: 'activa'; sesion: SesionResponse };

type ValorSesion = {
  estado: EstadoSesion;
  ingresar: (email: string, password: string) => Promise<SesionResponse>;
  /** Para los flujos que ya devuelven una sesión, como aceptar una invitación. */
  establecer: (sesion: SesionResponse) => void;
  salir: () => Promise<void>;
};

const ContextoSesion = createContext<ValorSesion | null>(null);

/**
 * Sesión de la web. Al abrir la página intenta recuperarla con la cookie de
 * renovación; si la API ya no la acepta, pasa a «vencida».
 */
export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: 'cargando' });

  useEffect(() => {
    alExpirarSesion(() => setEstado({ tipo: 'vencida' }));
    let vigente = true;
    void api.renovar().then((sesion) => {
      if (vigente) setEstado(sesion ? { tipo: 'activa', sesion } : { tipo: 'anonima' });
    });
    return () => {
      vigente = false;
    };
  }, []);

  const ingresar = useCallback(async (email: string, password: string) => {
    const sesion = await api.ingresar(email, password);
    setEstado({ tipo: 'activa', sesion });
    return sesion;
  }, []);

  const establecer = useCallback((sesion: SesionResponse) => {
    setEstado({ tipo: 'activa', sesion });
  }, []);

  const salir = useCallback(async () => {
    await api.cerrarSesion().catch(() => undefined);
    setEstado({ tipo: 'anonima' });
  }, []);

  const valor = useMemo(
    () => ({ estado, ingresar, establecer, salir }),
    [estado, ingresar, establecer, salir],
  );
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion fuera de SesionProvider.');
  return valor;
}

/**
 * Muestra el contenido solo con una sesión activa y un rol permitido. Sin sesión
 * lleva al ingreso; con la sesión vencida, a «Tu sesión terminó».
 */
export function ConSesion({
  roles,
  children,
}: {
  roles?: readonly RolUsuario[];
  children: (sesion: SesionResponse) => ReactNode;
}) {
  const { estado } = useSesion();
  const router = useRouter();
  const permitido = estado.tipo === 'activa' && (!roles || roles.includes(estado.sesion.rol));

  useEffect(() => {
    if (estado.tipo === 'anonima') router.replace('/ingresar');
    else if (estado.tipo === 'vencida') router.replace('/sesion-vencida');
    else if (estado.tipo === 'activa' && !permitido) router.replace('/');
  }, [estado, permitido, router]);

  if (estado.tipo !== 'activa' || !permitido) {
    return <PantallaEstado mascota="cargando" titulo="resto" mensaje="Preparando todo…" />;
  }
  return <>{children(estado.sesion)}</>;
}
