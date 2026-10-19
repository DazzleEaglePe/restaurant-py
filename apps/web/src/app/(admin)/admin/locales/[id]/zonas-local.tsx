'use client';

import type { Zona } from '@resto/contracts';
import { Aviso, Boton, Campo, Casilla, Dialogo, Insignia, Tarjeta } from '@resto/ui/componentes';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { useCarga } from '@/lib/carga';
import { mensajeDeError } from '@/lib/errores';
import { ListaOrdenable } from '@/lib/ordenable';

/**
 * Zonas del local: dónde se sentará quien come aquí (RF-MES-001). Sin números de
 * mesa (D12). El orden es el que verá la cajera al tomar el pedido.
 */
export function ZonasDelLocal({ localId }: { localId: string }) {
  const { datos: zonas, error, recargar } = useCarga(() => api.zonas.delLocal(localId));
  const [editando, setEditando] = useState<Zona | 'nueva' | null>(null);
  const [nombre, setNombre] = useState('');
  const [piso, setPiso] = useState('');
  const [activa, setActiva] = useState(true);
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function abrir(zona: Zona | 'nueva') {
    setErrorDialogo(null);
    setNombre(zona === 'nueva' ? '' : zona.nombre);
    setPiso(zona === 'nueva' ? '' : (zona.piso ?? ''));
    setActiva(zona === 'nueva' ? true : zona.activa);
    setEditando(zona);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!editando) return;
    setGuardando(true);
    setErrorDialogo(null);
    const datos = { nombre: nombre.trim(), piso: piso.trim() || null };
    try {
      if (editando === 'nueva') await api.zonas.crear(localId, datos);
      else await api.zonas.editar(editando.id, { ...datos, activa });
      setEditando(null);
      await recargar();
    } catch (problema) {
      setErrorDialogo(mensajeDeError(problema));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">Zonas</h2>
          <p className="text-sm text-muted">
            Dónde se sentará quien come aquí. La cajera las ve en este orden.
          </p>
        </div>
        <Boton variante="secundario" onClick={() => abrir('nueva')}>
          Nueva zona
        </Boton>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {zonas?.length === 0 && (
        <p className="text-muted">
          Todavía no hay zonas. Por ejemplo: «Patio de comida» en el 1er piso y «Terraza» en el 2do.
        </p>
      )}
      {zonas && zonas.length > 0 && (
        <ListaOrdenable
          elementos={zonas}
          nombre={(z) => z.nombre}
          alOrdenar={async (ids) => {
            await api.zonas.ordenar(localId, ids);
            await recargar();
          }}
        >
          {(zona, asa) => (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface py-1 pr-2">
              {asa}
              <button
                type="button"
                onClick={() => abrir(zona)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
              >
                <span className={zona.activa ? 'font-bold text-ink' : 'font-bold text-muted'}>
                  {zona.nombre}
                </span>
                {zona.piso && <span className="text-sm text-muted">{zona.piso}</span>}
                {!zona.activa && <Insignia tono="apagado">Desactivada</Insignia>}
              </button>
            </div>
          )}
        </ListaOrdenable>
      )}

      <Dialogo
        abierto={editando !== null}
        titulo={editando === 'nueva' ? 'Nueva zona' : 'Editar zona'}
        alCerrar={() => setEditando(null)}
      >
        <form onSubmit={guardar} className="flex flex-col gap-4">
          {errorDialogo && <Aviso tipo="error">{errorDialogo}</Aviso>}
          <Campo
            etiqueta="Nombre"
            ayuda="Como la dice la cajera, por ejemplo «Terraza»."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <Campo
            etiqueta="Piso (opcional)"
            placeholder="2do piso"
            value={piso}
            onChange={(e) => setPiso(e.target.value)}
          />
          {editando !== 'nueva' && (
            <Casilla checked={activa} onChange={(e) => setActiva(e.target.checked)}>
              La cajera puede elegirla
            </Casilla>
          )}
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setEditando(null)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={guardando} disabled={nombre.trim().length < 2}>
              {editando === 'nueva' ? 'Crear zona' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </Dialogo>
    </Tarjeta>
  );
}
