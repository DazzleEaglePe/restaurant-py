'use client';

import { cn } from '@resto/ui/cn';
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

/** Mueve el elemento de `desde` a `hasta` y devuelve la lista nueva. */
export function mover<T>(lista: readonly T[], desde: number, hasta: number): T[] {
  const copia = [...lista];
  const [elemento] = copia.splice(desde, 1);
  copia.splice(hasta, 0, elemento as T);
  return copia;
}

/**
 * Lista que se ordena arrastrando la asa con el dedo o el mouse (eventos de
 * puntero: el arrastre nativo del navegador no funciona en pantallas táctiles),
 * o con las flechas del teclado sobre la asa. Al soltar, `alOrdenar` recibe los
 * ids en el orden nuevo; si falla, la lista vuelve a como estaba.
 */
export function ListaOrdenable<T extends { id: string }>({
  elementos,
  nombre,
  alOrdenar,
  children,
  className,
}: {
  elementos: readonly T[];
  /** Cómo se llama cada elemento, para los lectores de pantalla. */
  nombre: (elemento: T) => string;
  alOrdenar: (ids: string[]) => Promise<void>;
  children: (elemento: T, asa: ReactNode, arrastrando: boolean) => ReactNode;
  className?: string;
}) {
  const [orden, setOrden] = useState(() => elementos.map((e) => e.id));
  const [arrastrado, setArrastrado] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const filas = useRef(new Map<string, HTMLLIElement>());
  const inicial = useRef<string[]>([]);

  // La lista de afuera manda cuando cambia (al crear, editar o recargar).
  const clave = elementos.map((e) => e.id).join(',');
  useEffect(() => {
    setOrden(elementos.map((e) => e.id));
    // `clave` resume los ids; cambiar solo su contenido no cambia el orden.
  }, [clave]);

  const porId = new Map(elementos.map((e) => [e.id, e]));
  const visibles = orden.map((id) => porId.get(id)).filter((e): e is T => e !== undefined);

  async function guardar(nuevo: string[], antes: string[]) {
    if (nuevo.join() === antes.join()) return;
    try {
      await alOrdenar(nuevo);
    } catch {
      setOrden(antes);
      setAnuncio('No pudimos guardar el orden. Intenta de nuevo.');
    }
  }

  function empezar(evento: PointerEvent<HTMLButtonElement>, id: string) {
    if (evento.button !== 0) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    inicial.current = orden;
    setArrastrado(id);
  }

  function arrastrar(evento: PointerEvent<HTMLButtonElement>) {
    if (!arrastrado) return;
    // Posición nueva: cuántas de las otras filas tienen su centro por encima del dedo.
    const otras = orden.filter((id) => id !== arrastrado);
    const destino = otras.filter((id) => {
      const caja = filas.current.get(id)?.getBoundingClientRect();
      return caja ? caja.top + caja.height / 2 < evento.clientY : false;
    }).length;
    const actual = orden.indexOf(arrastrado);
    if (destino !== actual) setOrden(mover(orden, actual, destino));
  }

  function soltar() {
    if (!arrastrado) return;
    const elemento = porId.get(arrastrado);
    setArrastrado(null);
    if (elemento)
      setAnuncio(`«${nombre(elemento)}» en el lugar ${orden.indexOf(elemento.id) + 1}.`);
    void guardar(orden, inicial.current);
  }

  function teclado(evento: KeyboardEvent<HTMLButtonElement>, id: string) {
    const paso = evento.key === 'ArrowUp' ? -1 : evento.key === 'ArrowDown' ? 1 : 0;
    if (!paso) return;
    evento.preventDefault();
    const desde = orden.indexOf(id);
    const hasta = Math.min(orden.length - 1, Math.max(0, desde + paso));
    if (hasta === desde) return;
    const nuevo = mover(orden, desde, hasta);
    setOrden(nuevo);
    const elemento = porId.get(id);
    if (elemento) setAnuncio(`«${nombre(elemento)}» en el lugar ${hasta + 1} de ${orden.length}.`);
    void guardar(nuevo, orden);
  }

  return (
    <>
      <ul className={cn('flex flex-col gap-2', className)}>
        {visibles.map((elemento) => {
          const arrastrando = arrastrado === elemento.id;
          const asa = (
            <button
              type="button"
              aria-label={`Mover «${nombre(elemento)}». Usa las flechas arriba y abajo.`}
              onPointerDown={(e) => empezar(e, elemento.id)}
              onPointerMove={arrastrar}
              onPointerUp={soltar}
              onPointerCancel={soltar}
              onKeyDown={(e) => teclado(e, elemento.id)}
              className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted hover:bg-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing"
            >
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
              </svg>
            </button>
          );
          return (
            <li
              key={elemento.id}
              ref={(nodo) => {
                if (nodo) filas.current.set(elemento.id, nodo);
                else filas.current.delete(elemento.id);
              }}
              className={cn(
                'rounded-2xl transition-[transform,box-shadow] duration-fast ease-standard',
                arrastrando && 'relative z-10 shadow-lg motion-safe:scale-[1.02]',
              )}
            >
              {children(elemento, asa, arrastrando)}
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </>
  );
}
