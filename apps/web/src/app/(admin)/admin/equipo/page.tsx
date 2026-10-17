'use client';

import type { Local, Miembro, RolUsuario } from '@resto/contracts';
import {
  Aviso,
  Boton,
  Campo,
  Casilla,
  Dialogo,
  Insignia,
  Selector,
  Tarjeta,
} from '@resto/ui/componentes';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { useCarga } from '@/lib/carga';
import { mensajeDeError } from '@/lib/errores';
import { useSesionAdmin } from '@/lib/sesion-admin';

const NOMBRE_ROL: Record<RolUsuario, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Admin',
  CAJERO: 'Cajero',
  MESERO: 'Mesero',
};

const necesitaLocales = (rol: RolUsuario) => rol === 'CAJERO' || rol === 'MESERO';

/** Locales a elegir para un cajero o mesero. */
function ElegirLocales({
  locales,
  elegidos,
  alCambiar,
}: {
  locales: Local[];
  elegidos: string[];
  alCambiar: (ids: string[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-bold text-ink">Locales donde trabaja</legend>
      {locales
        .filter((local) => local.activo)
        .map((local) => (
          <Casilla
            key={local.id}
            checked={elegidos.includes(local.id)}
            onChange={(e) =>
              alCambiar(
                e.target.checked
                  ? [...elegidos, local.id]
                  : elegidos.filter((id) => id !== local.id),
              )
            }
          >
            {local.nombre}
          </Casilla>
        ))}
    </fieldset>
  );
}

/** Equipo del negocio (docs/06_API_CONTRACT.md §4, docs/02 §3.1). */
export default function Equipo() {
  const sesion = useSesionAdmin();
  const { datos, error, recargar } = useCarga(async () => {
    const [equipo, locales] = await Promise.all([api.usuarios.listar(), api.locales.listar()]);
    return { equipo, locales };
  });
  const [aviso, setAviso] = useState<string | null>(null);

  // Invitación.
  const [invitando, setInvitando] = useState(false);
  const [nueva, setNueva] = useState({
    email: '',
    nombre: '',
    rol: 'CAJERO' as RolUsuario,
    local_ids: [] as string[],
  });
  const [errorInvitacion, setErrorInvitacion] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Edición.
  const [editando, setEditando] = useState<Miembro | null>(null);
  const [cambios, setCambios] = useState({
    rol: 'CAJERO' as RolUsuario,
    local_ids: [] as string[],
    activa: true,
  });
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const esDueno = sesion.rol === 'OWNER';
  // docs/06 §4: solo un OWNER cambia o nombra dueños; nadie se edita a sí mismo.
  const puedeEditar = (miembro: Miembro) =>
    miembro.id !== sesion.user.id && (esDueno || miembro.rol !== 'OWNER');
  const roles: RolUsuario[] = esDueno
    ? ['OWNER', 'ADMIN', 'CAJERO', 'MESERO']
    : ['ADMIN', 'CAJERO', 'MESERO'];
  const opcionesRol = roles.map((rol) => ({ valor: rol, texto: NOMBRE_ROL[rol] }));

  async function invitar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErrorInvitacion(null);
    try {
      const miembro = await api.usuarios.invitar({
        ...nueva,
        email: nueva.email.trim(),
        nombre: nueva.nombre.trim(),
        local_ids: necesitaLocales(nueva.rol) ? nueva.local_ids : [],
      });
      setInvitando(false);
      setNueva({ email: '', nombre: '', rol: 'CAJERO', local_ids: [] });
      setAviso(
        miembro.invitacion_pendiente
          ? `Le enviamos la invitación a ${miembro.email}.`
          : `${miembro.nombre} ya tenía cuenta y ahora es parte del equipo.`,
      );
      await recargar();
    } catch (problema) {
      setErrorInvitacion(mensajeDeError(problema));
    } finally {
      setEnviando(false);
    }
  }

  function abrirEdicion(miembro: Miembro) {
    setErrorEdicion(null);
    setCambios({
      rol: miembro.rol,
      local_ids: miembro.locales.map((local) => local.id),
      activa: miembro.activa,
    });
    setEditando(miembro);
  }

  async function guardarEdicion(evento: FormEvent) {
    evento.preventDefault();
    if (!editando) return;
    setEnviando(true);
    setErrorEdicion(null);
    try {
      await api.usuarios.editar(editando.id, {
        ...cambios,
        local_ids: necesitaLocales(cambios.rol) ? cambios.local_ids : [],
      });
      setEditando(null);
      // El cambio revoca sus sesiones (docs/07 §2.1): vuelve a ingresar y ya lo ve.
      setAviso(
        `Guardamos los cambios de ${editando.nombre}. Verá sus nuevos permisos al volver a ingresar.`,
      );
      await recargar();
    } catch (problema) {
      setErrorEdicion(mensajeDeError(problema));
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar(miembro: Miembro) {
    setAviso(null);
    try {
      await api.usuarios.reenviarInvitacion(miembro.id);
      setAviso(`Reenviamos la invitación a ${miembro.email}. El enlace anterior ya no sirve.`);
    } catch (problema) {
      setAviso(mensajeDeError(problema));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-titulo text-2xl text-ink">Equipo</h1>
        <Boton onClick={() => setInvitando(true)}>Invitar</Boton>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

      <ul className="flex flex-col gap-3">
        {datos?.equipo.map((miembro) => (
          <li key={miembro.id}>
            <Tarjeta className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-ink">{miembro.nombre}</p>
                  <Insignia tono="marca">{NOMBRE_ROL[miembro.rol]}</Insignia>
                  {miembro.invitacion_pendiente && (
                    <Insignia tono="aviso">Invitación pendiente</Insignia>
                  )}
                  {!miembro.activa && <Insignia tono="apagado">Desactivado</Insignia>}
                </div>
                <p className="truncate text-sm text-muted">{miembro.email}</p>
                {necesitaLocales(miembro.rol) && (
                  <p className="text-sm text-muted">
                    {miembro.locales.map((local) => local.nombre).join(' · ') || 'Sin local'}
                  </p>
                )}
              </div>
              {puedeEditar(miembro) && (
                <div className="flex gap-2">
                  {miembro.invitacion_pendiente && (
                    <Boton variante="secundario" onClick={() => reenviar(miembro)}>
                      Reenviar
                    </Boton>
                  )}
                  <Boton variante="secundario" onClick={() => abrirEdicion(miembro)}>
                    Editar
                  </Boton>
                </div>
              )}
            </Tarjeta>
          </li>
        ))}
      </ul>

      <Dialogo abierto={invitando} titulo="Invitar al equipo" alCerrar={() => setInvitando(false)}>
        <form onSubmit={invitar} className="flex flex-col gap-4">
          {errorInvitacion && <Aviso tipo="error">{errorInvitacion}</Aviso>}
          <Campo
            etiqueta="Nombre"
            value={nueva.nombre}
            onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
          />
          <Campo
            etiqueta="Correo"
            type="email"
            inputMode="email"
            value={nueva.email}
            onChange={(e) => setNueva({ ...nueva, email: e.target.value })}
          />
          <Selector
            etiqueta="Rol"
            opciones={opcionesRol}
            value={nueva.rol}
            onChange={(e) => setNueva({ ...nueva, rol: e.target.value as RolUsuario })}
          />
          {necesitaLocales(nueva.rol) && datos && (
            <ElegirLocales
              locales={datos.locales}
              elegidos={nueva.local_ids}
              alCambiar={(local_ids) => setNueva({ ...nueva, local_ids })}
            />
          )}
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setInvitando(false)}>
              Cancelar
            </Boton>
            <Boton
              type="submit"
              cargando={enviando}
              disabled={
                !nueva.email ||
                nueva.nombre.trim().length < 2 ||
                (necesitaLocales(nueva.rol) && nueva.local_ids.length === 0)
              }
            >
              Enviar invitación
            </Boton>
          </div>
        </form>
      </Dialogo>

      <Dialogo
        abierto={editando !== null}
        titulo={`Editar a ${editando?.nombre ?? ''}`}
        alCerrar={() => setEditando(null)}
      >
        <form onSubmit={guardarEdicion} className="flex flex-col gap-4">
          {errorEdicion && <Aviso tipo="error">{errorEdicion}</Aviso>}
          <Selector
            etiqueta="Rol"
            opciones={opcionesRol}
            value={cambios.rol}
            onChange={(e) => setCambios({ ...cambios, rol: e.target.value as RolUsuario })}
          />
          {necesitaLocales(cambios.rol) && datos && (
            <ElegirLocales
              locales={datos.locales}
              elegidos={cambios.local_ids}
              alCambiar={(local_ids) => setCambios({ ...cambios, local_ids })}
            />
          )}
          <Casilla
            checked={cambios.activa}
            onChange={(e) => setCambios({ ...cambios, activa: e.target.checked })}
          >
            Puede ingresar
          </Casilla>
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setEditando(null)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={enviando}>
              Guardar cambios
            </Boton>
          </div>
        </form>
      </Dialogo>
    </>
  );
}
