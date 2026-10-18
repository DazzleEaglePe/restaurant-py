'use client';

import type { CrearNegocioPlataforma, NegocioPlataforma } from '@resto/contracts';
import { Aviso, Boton, Campo, Dialogo, Insignia, Tarjeta } from '@resto/ui/componentes';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { useCarga } from '@/lib/carga';
import { mensajeDeError } from '@/lib/errores';

const ALTA_VACIA: CrearNegocioPlataforma = {
  nombre_comercial: '',
  local_inicial: '',
  owner: { nombre: '', email: '' },
};

const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' });

/** Negocios: alta asistida, suspensión y reactivación (docs/06_API_CONTRACT.md §19). */
export default function Negocios() {
  const { datos: negocios, error, cargando, recargar } = useCarga(() => api.negocios.listar());
  const [aviso, setAviso] = useState<string | null>(null);

  // Alta.
  const [creando, setCreando] = useState(false);
  const [alta, setAlta] = useState(ALTA_VACIA);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Suspensión: se confirma porque deja fuera a todo el equipo del negocio.
  const [suspendiendo, setSuspendiendo] = useState<NegocioPlataforma | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  const activos = negocios?.filter((negocio) => negocio.estado === 'ACTIVO').length ?? 0;

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErrorAlta(null);
    try {
      const negocio = await api.negocios.crear({
        nombre_comercial: alta.nombre_comercial.trim(),
        local_inicial: alta.local_inicial.trim(),
        owner: { nombre: alta.owner.nombre.trim(), email: alta.owner.email.trim() },
      });
      const dueno = negocio.duenos[0];
      setCreando(false);
      setAlta(ALTA_VACIA);
      setAviso(
        dueno?.invitacion_pendiente === false
          ? `Creamos «${negocio.nombre_comercial}». ${dueno.email} ya tenía cuenta: le avisamos por correo que ahora es dueño.`
          : `Creamos «${negocio.nombre_comercial}» y le enviamos la invitación a ${dueno?.email ?? 'su dueño'}.`,
      );
      await recargar();
    } catch (problema) {
      setErrorAlta(mensajeDeError(problema));
    } finally {
      setEnviando(false);
    }
  }

  async function suspender(evento: FormEvent) {
    evento.preventDefault();
    if (!suspendiendo) return;
    setEnviando(true);
    setErrorEstado(null);
    try {
      await api.negocios.suspender(suspendiendo.id);
      setAviso(`Suspendimos «${suspendiendo.nombre_comercial}». Su equipo ya no puede ingresar.`);
      setSuspendiendo(null);
      await recargar();
    } catch (problema) {
      setErrorEstado(mensajeDeError(problema));
    } finally {
      setEnviando(false);
    }
  }

  async function reactivar(negocio: NegocioPlataforma) {
    setAviso(null);
    try {
      await api.negocios.reactivar(negocio.id);
      setAviso(`Reactivamos «${negocio.nombre_comercial}». Su equipo ya puede ingresar.`);
      await recargar();
    } catch (problema) {
      setAviso(mensajeDeError(problema));
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-titulo text-2xl text-ink">Negocios</h1>
          {negocios && (
            <p className="text-muted">
              {negocios.length} {negocios.length === 1 ? 'negocio' : 'negocios'} · {activos}{' '}
              {activos === 1 ? 'activo' : 'activos'}
            </p>
          )}
        </div>
        <Boton
          onClick={() => {
            setErrorAlta(null);
            setCreando(true);
          }}
        >
          Nuevo negocio
        </Boton>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
      {!cargando && negocios?.length === 0 && (
        <Tarjeta className="text-muted">
          Todavía no hay negocios. Da de alta el primero con «Nuevo negocio».
        </Tarjeta>
      )}

      <ul className="flex flex-col gap-3">
        {negocios?.map((negocio) => (
          <li key={negocio.id}>
            <Tarjeta className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-ink">{negocio.nombre_comercial}</p>
                  {negocio.estado === 'ACTIVO' ? (
                    <Insignia tono="marca">Activo</Insignia>
                  ) : (
                    <Insignia tono="aviso">Suspendido</Insignia>
                  )}
                </div>
                <p className="text-sm text-muted">
                  {negocio.locales} {negocio.locales === 1 ? 'local' : 'locales'} · Alta el{' '}
                  {fecha.format(new Date(negocio.created_at))}
                </p>
                <ul className="flex flex-col gap-0.5 text-sm text-muted">
                  {negocio.duenos.map((dueno) => (
                    <li key={dueno.email} className="flex flex-wrap items-center gap-2">
                      <span className="truncate">Dueño: {dueno.email}</span>
                      {dueno.invitacion_pendiente && (
                        <Insignia tono="apagado">Invitación pendiente</Insignia>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {negocio.estado === 'ACTIVO' ? (
                <Boton
                  variante="peligro"
                  onClick={() => {
                    setErrorEstado(null);
                    setSuspendiendo(negocio);
                  }}
                >
                  Suspender
                </Boton>
              ) : (
                <Boton variante="secundario" onClick={() => reactivar(negocio)}>
                  Reactivar
                </Boton>
              )}
            </Tarjeta>
          </li>
        ))}
      </ul>

      <Dialogo abierto={creando} titulo="Nuevo negocio" alCerrar={() => setCreando(false)}>
        <form onSubmit={crear} className="flex flex-col gap-4">
          {errorAlta && <Aviso tipo="error">{errorAlta}</Aviso>}
          <Campo
            etiqueta="Nombre comercial"
            value={alta.nombre_comercial}
            onChange={(e) => setAlta({ ...alta, nombre_comercial: e.target.value })}
          />
          <Campo
            etiqueta="Primer local"
            ayuda="Por ejemplo «Centro». El dueño crea los demás."
            value={alta.local_inicial}
            onChange={(e) => setAlta({ ...alta, local_inicial: e.target.value })}
          />
          <Campo
            etiqueta="Nombre del dueño"
            value={alta.owner.nombre}
            onChange={(e) => setAlta({ ...alta, owner: { ...alta.owner, nombre: e.target.value } })}
          />
          <Campo
            etiqueta="Correo del dueño"
            type="email"
            inputMode="email"
            ayuda="Le llega la invitación para crear su contraseña."
            value={alta.owner.email}
            onChange={(e) => setAlta({ ...alta, owner: { ...alta.owner, email: e.target.value } })}
          />
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setCreando(false)}>
              Cancelar
            </Boton>
            <Boton
              type="submit"
              cargando={enviando}
              disabled={
                alta.nombre_comercial.trim().length < 2 ||
                alta.local_inicial.trim().length < 2 ||
                alta.owner.nombre.trim().length < 2 ||
                !alta.owner.email.trim()
              }
            >
              Crear e invitar
            </Boton>
          </div>
        </form>
      </Dialogo>

      <Dialogo
        abierto={suspendiendo !== null}
        titulo={`¿Suspender «${suspendiendo?.nombre_comercial ?? ''}»?`}
        alCerrar={() => setSuspendiendo(null)}
      >
        <form onSubmit={suspender} className="flex flex-col gap-4">
          {errorEstado && <Aviso tipo="error">{errorEstado}</Aviso>}
          <p className="text-ink">
            Nadie de su equipo podrá ingresar hasta que lo reactives, y las sesiones abiertas
            terminan en 15 minutos como máximo. Sus datos se conservan.
          </p>
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setSuspendiendo(null)}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="peligro" cargando={enviando}>
              Suspender negocio
            </Boton>
          </div>
        </form>
      </Dialogo>
    </>
  );
}
