'use client';

import type { Carta } from '@resto/contracts';
import { Aviso, Insignia, Selector, Tarjeta } from '@resto/ui/componentes';
import { cn } from '@resto/ui/cn';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { useCarga } from '@/lib/carga';
import { mensajeDeError } from '@/lib/errores';
import { soles } from '@/lib/montos';

/**
 * La carta de un local tal como la verá la caja (docs/08_UX_FLUJOS.md §3, paso 8):
 * solo lo activo y habilitado ahí, con su precio y lo agotado.
 */
export default function VistaPrevia() {
  const { datos: locales, error: errorLocales } = useCarga(() => api.locales.listar());
  const [localId, setLocalId] = useState('');
  const [carta, setCarta] = useState<Carta | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localId && locales?.length) setLocalId(locales[0]!.id);
  }, [locales, localId]);

  useEffect(() => {
    if (!localId) return;
    setCarta(null);
    setError(null);
    api.carta.obtener(localId).then(
      (respuesta) => {
        setCarta(respuesta);
        setCategoria(respuesta.categorias[0]?.id ?? null);
      },
      (problema) => setError(mensajeDeError(problema)),
    );
  }, [localId]);

  const local = locales?.find((l) => l.id === localId);
  const visible = carta?.categorias.find((c) => c.id === categoria) ?? carta?.categorias[0];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/carta" className="text-sm font-bold text-brand">
            ← Carta
          </Link>
          <h1 className="font-titulo text-2xl text-ink">Vista previa</h1>
        </div>
        {locales && locales.length > 1 && (
          <Selector
            etiqueta="Local"
            opciones={locales.map((l) => ({ valor: l.id, texto: l.nombre }))}
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            className="min-w-48"
          />
        )}
      </div>
      {(errorLocales || error) && <Aviso tipo="error">{errorLocales ?? error}</Aviso>}

      <section
        aria-label={`Carta de ${local?.nombre ?? 'el local'} como la ve la caja`}
        className="mx-auto flex w-full max-w-[390px] flex-col gap-3 rounded-[2rem] border border-line bg-bg p-4 shadow-sm"
      >
        <p className="text-sm text-muted">Caja · {local?.nombre ?? '…'}</p>
        {carta && carta.categorias.length === 0 && (
          <Tarjeta className="text-muted">
            Este local todavía no tiene nada para vender. Agrega productos o habilítalos aquí.
          </Tarjeta>
        )}
        {carta && carta.categorias.length > 0 && (
          <>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
              {carta.categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === visible?.id}
                  onClick={() => setCategoria(c.id)}
                  className={cn(
                    'min-h-10 shrink-0 rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors duration-fast',
                    c.id === visible?.id ? 'bg-brand text-white' : 'bg-surface text-ink',
                  )}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-3" role="tabpanel">
              {visible?.productos.map((p) => (
                <li key={p.id}>
                  <Tarjeta
                    className={cn(
                      'flex h-full flex-col justify-between gap-2 p-3',
                      p.agotado && 'opacity-60',
                    )}
                  >
                    <span className="flex flex-col gap-1">
                      <span className="leading-tight font-bold text-ink">{p.nombre}</span>
                      {p.componentes.length > 0 && (
                        <span className="text-xs text-muted">
                          {p.componentes.map((x) => x.nombre).join(' + ')}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-1">
                      <span className="cifras font-bold text-ink">{soles(p.precio)}</span>
                      {p.agotado && <Insignia tono="apagado">Agotado</Insignia>}
                    </span>
                  </Tarjeta>
                </li>
              ))}
            </ul>
          </>
        )}
        {!carta && !error && <p className="text-muted">Cargando la carta…</p>}
      </section>
    </>
  );
}
