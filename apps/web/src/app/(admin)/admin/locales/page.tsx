'use client';

import { Aviso, Boton, Campo, Dialogo, Insignia, Tarjeta } from '@resto/ui/componentes';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { useCarga } from '@/lib/carga';
import { mensajeDeError } from '@/lib/errores';

/** Locales del negocio (docs/06_API_CONTRACT.md §3). */
export default function Locales() {
  const { datos: locales, error, recargar } = useCarga(() => api.locales.listar());
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [errorCreacion, setErrorCreacion] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setErrorCreacion(null);
    try {
      await api.locales.crear({ nombre: nombre.trim(), direccion: direccion.trim() || null });
      setCreando(false);
      setNombre('');
      setDireccion('');
      await recargar();
    } catch (problema) {
      setErrorCreacion(mensajeDeError(problema));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-titulo text-2xl text-ink">Locales</h1>
        <Boton onClick={() => setCreando(true)}>Nuevo local</Boton>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {locales?.length === 0 && (
        <Tarjeta className="text-muted">
          Todavía no hay locales. Crea el primero para asignarle su caja.
        </Tarjeta>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {locales?.map((local) => (
          <li key={local.id}>
            <Link href={`/admin/locales/${local.id}`} className="block rounded-2xl">
              <Tarjeta className="flex flex-col gap-2 transition-colors duration-fast hover:border-brand">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-bold text-ink">{local.nombre}</p>
                  {!local.activo && <Insignia tono="apagado">Desactivado</Insignia>}
                </div>
                <p className="truncate text-sm text-muted">{local.direccion ?? 'Sin dirección'}</p>
                <p className="text-sm text-muted">
                  Ventana de pagos: {local.ventana_pagos_min} min · Táper S/{' '}
                  <span className="cifras">{local.costo_taper_defecto}</span>
                </p>
              </Tarjeta>
            </Link>
          </li>
        ))}
      </ul>

      <Dialogo abierto={creando} titulo="Nuevo local" alCerrar={() => setCreando(false)}>
        <form onSubmit={crear} className="flex flex-col gap-4">
          {errorCreacion && <Aviso tipo="error">{errorCreacion}</Aviso>}
          <Campo
            etiqueta="Nombre"
            ayuda="Como lo reconoce tu equipo, por ejemplo «Centro»."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <Campo
            etiqueta="Dirección (opcional)"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setCreando(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={guardando} disabled={nombre.trim().length < 2}>
              Crear local
            </Boton>
          </div>
        </form>
      </Dialogo>
    </>
  );
}
