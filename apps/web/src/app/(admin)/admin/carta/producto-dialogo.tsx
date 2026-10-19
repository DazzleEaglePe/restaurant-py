'use client';

import type { Categoria, Local, Producto } from '@resto/contracts';
import { Aviso, Boton, Campo, Casilla, Dialogo, Selector } from '@resto/ui/componentes';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { mensajeDeError } from '@/lib/errores';
import { aMonto } from '@/lib/montos';

type EnLocal = { habilitado: boolean; precio: string };

type Formulario = {
  categoria_id: string;
  nombre: string;
  descripcion: string;
  precio: string;
  costo_taper: string;
  requiere_cocina: boolean;
  activo: boolean;
  esCombo: boolean;
  /** producto_id → cantidad de los platos elegidos. */
  platos: Record<string, number>;
  locales: Record<string, EnLocal>;
};

function aFormulario(
  producto: Producto | null,
  categoriaInicial: string,
  locales: Local[],
): Formulario {
  const enLocal = (localId: string): EnLocal => {
    const fila = producto?.locales.find((l) => l.local_id === localId);
    return { habilitado: fila?.habilitado ?? true, precio: fila?.precio_local ?? '' };
  };
  return {
    categoria_id: producto?.categoria_id ?? categoriaInicial,
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    precio: producto?.precio ?? '',
    // Un producto nuevo parte del táper por defecto del primer local (D21).
    costo_taper: producto?.costo_taper ?? locales[0]?.costo_taper_defecto ?? '0.00',
    requiere_cocina: producto?.requiere_cocina ?? true,
    activo: producto?.activo ?? true,
    esCombo: producto?.es_combo ?? false,
    platos: Object.fromEntries(producto?.componentes.map((c) => [c.producto_id, c.cantidad]) ?? []),
    locales: Object.fromEntries(locales.map((l) => [l.id, enLocal(l.id)])),
  };
}

/**
 * Crear o editar un producto o combo (RF-CAR-002, 003, 006, 009 y 011). Al
 * editar también se decide en qué locales se vende y a qué precio.
 */
export function ProductoDialogo({
  abierto,
  producto,
  categoriaInicial,
  categorias,
  productos,
  locales,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  /** `null` para uno nuevo. */
  producto: Producto | null;
  categoriaInicial: string;
  categorias: Categoria[];
  productos: Producto[];
  locales: Local[];
  alCerrar: () => void;
  alGuardar: (producto: Producto, nuevo: boolean) => void;
}) {
  const [f, setF] = useState(() => aFormulario(producto, categoriaInicial, locales));
  const [error, setError] = useState<string | null>(null);
  const avisoError = useRef<HTMLDivElement>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setF(aFormulario(producto, categoriaInicial, locales));
      setError(null);
    }
  }, [abierto, producto, categoriaInicial, locales]);

  // El formulario es largo: el aviso aparece arriba y se lleva a la vista.
  useEffect(() => {
    if (error) avisoError.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) =>
    setF((actual) => ({ ...actual, [campo]: valor }));

  // Un combo lleva platos simples, nunca otro combo ni a sí mismo.
  const platosPosibles = productos.filter((p) => !p.es_combo && p.id !== producto?.id);
  // Un plato que ya está en un combo no puede volverse combo.
  const esPlatoDeCombo =
    producto !== null &&
    productos.some((p) => p.componentes.some((c) => c.producto_id === producto.id));
  const elegidos = Object.entries(f.platos).filter(([, cantidad]) => cantidad > 0);

  function cantidad(productoId: string, delta: number) {
    const actual = f.platos[productoId] ?? 0;
    cambiar('platos', { ...f.platos, [productoId]: Math.max(0, Math.min(20, actual + delta)) });
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const precio = aMonto(f.precio);
    const taper = aMonto(f.costo_taper);
    if (!precio) return setError('Revisa los datos. Precio: escribe un monto, por ejemplo 25.00.');
    if (taper === undefined)
      return setError('Revisa los datos. Táper: escribe un monto o déjalo vacío.');
    if (f.esCombo && elegidos.length < 2) {
      return setError('Un combo lleva al menos dos platos. Elígelos abajo.');
    }
    const preciosLocales = Object.entries(f.locales).map(([localId, l]) => [
      localId,
      aMonto(l.precio),
    ]);
    if (preciosLocales.some(([, monto]) => monto === undefined)) {
      return setError('Revisa los datos. Precio en el local: escribe un monto o déjalo vacío.');
    }

    setGuardando(true);
    setError(null);
    const datos = {
      categoria_id: f.categoria_id,
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim() || null,
      precio,
      costo_taper: taper ?? '0.00',
      requiere_cocina: f.requiere_cocina,
      componentes: f.esCombo
        ? elegidos.map(([producto_id, n]) => ({ producto_id, cantidad: n }))
        : [],
    };
    try {
      let guardado = producto
        ? await api.productos.editar(producto.id, { ...datos, activo: f.activo })
        : await api.productos.crear(datos);
      // Disponibilidad por local: solo lo que cambió respecto de lo guardado.
      for (const local of locales) {
        const quiere = f.locales[local.id]!;
        const precioLocal = aMonto(quiere.precio) ?? null;
        const tenia = guardado.locales.find((l) => l.local_id === local.id);
        const igual =
          (tenia?.habilitado ?? true) === quiere.habilitado &&
          (tenia?.precio_local ?? null) === precioLocal;
        if (!igual) {
          guardado = await api.productos.enLocal(guardado.id, local.id, {
            habilitado: quiere.habilitado,
            precio_local: precioLocal,
          });
        }
      }
      alGuardar(guardado, producto === null);
    } catch (problema) {
      setError(mensajeDeError(problema));
    } finally {
      setGuardando(false);
    }
  }

  const titulo = producto
    ? `Editar ${producto.nombre}`
    : f.esCombo
      ? 'Nuevo combo'
      : 'Nuevo producto';

  return (
    <Dialogo abierto={abierto} titulo={titulo} alCerrar={alCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
        <div ref={avisoError} className="empty:hidden">
          {error && <Aviso tipo="error">{error}</Aviso>}
        </div>
        <Selector
          etiqueta="Categoría"
          opciones={categorias.map((c) => ({ valor: c.id, texto: c.nombre }))}
          value={f.categoria_id}
          onChange={(e) => cambiar('categoria_id', e.target.value)}
        />
        <Campo
          etiqueta="Nombre"
          value={f.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          required
        />
        <Campo
          etiqueta="Descripción (opcional)"
          ayuda="La ve la cajera al tocar el plato."
          value={f.descripcion}
          onChange={(e) => cambiar('descripcion', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo
            etiqueta="Precio (S/)"
            inputMode="decimal"
            placeholder="25.00"
            value={f.precio}
            onChange={(e) => cambiar('precio', e.target.value)}
            required
          />
          <Campo
            etiqueta="Táper (S/)"
            inputMode="decimal"
            placeholder="0.00"
            ayuda="Se suma para llevar."
            value={f.costo_taper}
            onChange={(e) => cambiar('costo_taper', e.target.value)}
          />
        </div>
        <Casilla
          checked={f.requiere_cocina}
          onChange={(e) => cambiar('requiere_cocina', e.target.checked)}
        >
          Pasa por cocina
        </Casilla>

        {!esPlatoDeCombo && (
          <Casilla checked={f.esCombo} onChange={(e) => cambiar('esCombo', e.target.checked)}>
            Es un combo de platos fijos
          </Casilla>
        )}
        {f.esCombo && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-bold text-ink">Platos del combo</legend>
            {platosPosibles.length === 0 && (
              <p className="text-sm text-muted">Primero crea los platos que lleva el combo.</p>
            )}
            <ul className="flex flex-col gap-1">
              {platosPosibles.map((plato) => {
                const n = f.platos[plato.id] ?? 0;
                return (
                  <li
                    key={plato.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-1.5"
                  >
                    <span className={n > 0 ? 'font-bold text-ink' : 'text-muted'}>
                      {plato.nombre}
                    </span>
                    <span className="flex items-center gap-1">
                      <Boton
                        variante="fantasma"
                        className="size-10 min-h-10 px-0"
                        aria-label={`Quitar uno de ${plato.nombre}`}
                        disabled={n === 0}
                        onClick={() => cantidad(plato.id, -1)}
                      >
                        −
                      </Boton>
                      <span
                        className="cifras w-6 text-center font-bold text-ink"
                        aria-live="polite"
                      >
                        {n}
                      </span>
                      <Boton
                        variante="fantasma"
                        className="size-10 min-h-10 px-0"
                        aria-label={`Agregar uno de ${plato.nombre}`}
                        onClick={() => cantidad(plato.id, 1)}
                      >
                        +
                      </Boton>
                    </span>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {producto && (
          <Casilla checked={f.activo} onChange={(e) => cambiar('activo', e.target.checked)}>
            Disponible en la carta
          </Casilla>
        )}

        {locales.length > 0 && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-sm font-bold text-ink">En cada local</legend>
            {locales.map((local) => {
              const l = f.locales[local.id]!;
              const fijar = (cambios: Partial<EnLocal>) =>
                cambiar('locales', { ...f.locales, [local.id]: { ...l, ...cambios } });
              return (
                <div key={local.id} className="flex flex-col gap-2 rounded-xl bg-soft/60 p-3">
                  <Casilla
                    checked={l.habilitado}
                    onChange={(e) => fijar({ habilitado: e.target.checked })}
                  >
                    Se vende en {local.nombre}
                  </Casilla>
                  {l.habilitado && (
                    <Campo
                      etiqueta={`Precio en ${local.nombre} (opcional)`}
                      inputMode="decimal"
                      placeholder={aMonto(f.precio) ?? 'Igual al general'}
                      ayuda="Vacío: el precio general."
                      value={l.precio}
                      onChange={(e) => fijar({ precio: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </fieldset>
        )}

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            cargando={guardando}
            disabled={f.nombre.trim().length < 2 || !f.precio.trim() || !f.categoria_id}
          >
            {producto ? 'Guardar cambios' : 'Crear'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
