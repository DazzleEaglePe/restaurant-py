'use client';

import type { Categoria, Producto } from '@resto/contracts';
import { Aviso, Boton, Campo, Casilla, Dialogo, Insignia, Tarjeta } from '@resto/ui/componentes';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { useCarga } from '@/lib/carga';
import { mensajeDeError } from '@/lib/errores';
import { soles } from '@/lib/montos';
import { ListaOrdenable } from '@/lib/ordenable';

import { ProductoDialogo } from './producto-dialogo';

/** Carta: categorías, productos y combos (docs/08_UX_FLUJOS.md §2.4, RF-CAR-001 a 011). */
export default function Carta() {
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const [categorias, productos, locales] = await Promise.all([
      api.categorias.listar(),
      api.productos.listar(),
      api.locales.listar(),
    ]);
    return { categorias, productos, locales };
  });
  const [aviso, setAviso] = useState<string | null>(null);

  // Categoría: crear o editar.
  const [categoria, setCategoria] = useState<Categoria | 'nueva' | null>(null);
  const [nombreCategoria, setNombreCategoria] = useState('');
  const [activaCategoria, setActivaCategoria] = useState(true);
  const [errorCategoria, setErrorCategoria] = useState<string | null>(null);
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);

  // Producto: crear o editar.
  const [producto, setProducto] = useState<{ producto: Producto | null; categoria: string } | null>(
    null,
  );

  function abrirCategoria(c: Categoria | 'nueva') {
    setErrorCategoria(null);
    setNombreCategoria(c === 'nueva' ? '' : c.nombre);
    setActivaCategoria(c === 'nueva' ? true : c.activa);
    setCategoria(c);
  }

  async function guardarCategoria(evento: FormEvent) {
    evento.preventDefault();
    if (!categoria) return;
    setGuardandoCategoria(true);
    setErrorCategoria(null);
    try {
      const nombre = nombreCategoria.trim();
      if (categoria === 'nueva') {
        await api.categorias.crear({ nombre });
        setAviso(`Creamos la categoría «${nombre}». Ahora agrégale productos.`);
      } else {
        await api.categorias.editar(categoria.id, { nombre, activa: activaCategoria });
        setAviso(
          activaCategoria
            ? `Guardamos «${nombre}».`
            : `«${nombre}» quedó oculta: sus productos no se ven en la caja.`,
        );
      }
      setCategoria(null);
      await recargar();
    } catch (problema) {
      setErrorCategoria(mensajeDeError(problema));
    } finally {
      setGuardandoCategoria(false);
    }
  }

  const ordenarCategorias = async (ids: string[]) => {
    await api.categorias.ordenar(ids);
    await recargar();
  };
  const ordenarProductos = async (ids: string[]) => {
    await api.productos.ordenar(ids);
    await recargar();
  };

  const categorias = datos?.categorias ?? [];
  const productosDe = (categoriaId: string) =>
    (datos?.productos ?? [])
      .filter((p) => p.categoria_id === categoriaId)
      .sort((a, b) => a.orden - b.orden);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-titulo text-2xl text-ink">Carta</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/carta/vista-previa"
            className="inline-flex min-h-12 items-center rounded-xl px-4 font-bold text-brand hover:bg-soft"
          >
            Vista previa
          </Link>
          <Boton variante="secundario" onClick={() => abrirCategoria('nueva')}>
            Nueva categoría
          </Boton>
          {categorias.length > 0 && (
            <Boton onClick={() => setProducto({ producto: null, categoria: categorias[0]!.id })}>
              Nuevo producto
            </Boton>
          )}
        </div>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

      {!cargando && categorias.length === 0 && (
        <Tarjeta className="flex flex-col gap-1 p-5">
          <p className="font-bold text-ink">Empieza por las categorías.</p>
          <p className="text-muted">
            Por ejemplo: Ceviches, Combinados, Platos de fondo y Bebidas. Luego agregas los platos
            de cada una.
          </p>
        </Tarjeta>
      )}

      {datos && categorias.length > 0 && (
        <ListaOrdenable
          elementos={categorias}
          nombre={(c) => c.nombre}
          alOrdenar={ordenarCategorias}
          className="gap-4"
        >
          {(c, asa) => {
            const productos = productosDe(c.id);
            return (
              <Tarjeta className="flex flex-col gap-3 p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  {asa}
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <h2 className="truncate font-titulo text-lg text-ink">{c.nombre}</h2>
                    <span className="text-sm text-muted">
                      {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
                    </span>
                    {!c.activa && <Insignia tono="apagado">Oculta</Insignia>}
                  </div>
                  <Boton
                    variante="fantasma"
                    className="min-h-10 px-3"
                    onClick={() => abrirCategoria(c)}
                  >
                    Editar
                  </Boton>
                </div>

                {productos.length > 0 ? (
                  <ListaOrdenable
                    elementos={productos}
                    nombre={(p) => p.nombre}
                    alOrdenar={ordenarProductos}
                  >
                    {(p, asaProducto) => (
                      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface py-1 pr-2">
                        {asaProducto}
                        <button
                          type="button"
                          onClick={() => setProducto({ producto: p, categoria: c.id })}
                          className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg text-left"
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={p.activo ? 'font-bold text-ink' : 'font-bold text-muted'}
                              >
                                {p.nombre}
                              </span>
                              {p.es_combo && <Insignia tono="marca">Combo</Insignia>}
                              {!p.requiere_cocina && <Insignia>Sin cocina</Insignia>}
                              {!p.activo && <Insignia tono="apagado">No disponible</Insignia>}
                            </span>
                            {p.es_combo && (
                              <span className="truncate text-sm text-muted">
                                {p.componentes
                                  .map((x) =>
                                    x.cantidad > 1 ? `${x.cantidad} × ${x.nombre}` : x.nombre,
                                  )
                                  .join(' + ')}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 flex-col items-end">
                            <span className="cifras font-bold text-ink">{soles(p.precio)}</span>
                            {p.costo_taper !== '0.00' && (
                              <span className="cifras text-xs text-muted">
                                + táper {soles(p.costo_taper)}
                              </span>
                            )}
                          </span>
                        </button>
                      </div>
                    )}
                  </ListaOrdenable>
                ) : (
                  <p className="px-2 text-sm text-muted">Todavía no tiene productos.</p>
                )}
                <Boton
                  variante="fantasma"
                  className="self-start"
                  onClick={() => setProducto({ producto: null, categoria: c.id })}
                >
                  + Agregar a {c.nombre}
                </Boton>
              </Tarjeta>
            );
          }}
        </ListaOrdenable>
      )}

      <Dialogo
        abierto={categoria !== null}
        titulo={categoria === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
        alCerrar={() => setCategoria(null)}
      >
        <form onSubmit={guardarCategoria} className="flex flex-col gap-4">
          {errorCategoria && <Aviso tipo="error">{errorCategoria}</Aviso>}
          <Campo
            etiqueta="Nombre"
            ayuda="Como la verá la cajera, por ejemplo «Ceviches»."
            value={nombreCategoria}
            onChange={(e) => setNombreCategoria(e.target.value)}
            required
          />
          {categoria !== 'nueva' && (
            <Casilla
              checked={activaCategoria}
              onChange={(e) => setActivaCategoria(e.target.checked)}
            >
              Visible en la caja
            </Casilla>
          )}
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setCategoria(null)}>
              Cancelar
            </Boton>
            <Boton
              type="submit"
              cargando={guardandoCategoria}
              disabled={nombreCategoria.trim().length < 2}
            >
              {categoria === 'nueva' ? 'Crear categoría' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </Dialogo>

      {datos && (
        <ProductoDialogo
          abierto={producto !== null}
          producto={producto?.producto ?? null}
          categoriaInicial={producto?.categoria ?? categorias[0]?.id ?? ''}
          categorias={categorias}
          productos={datos.productos}
          locales={datos.locales}
          alCerrar={() => setProducto(null)}
          alGuardar={async (guardado, nuevo) => {
            setProducto(null);
            setAviso(nuevo ? `Agregamos «${guardado.nombre}».` : `Guardamos «${guardado.nombre}».`);
            await recargar();
          }}
        />
      )}
    </>
  );
}
