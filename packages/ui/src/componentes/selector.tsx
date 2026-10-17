import { type SelectHTMLAttributes, useId } from 'react';

import { cn } from '../lib/cn.js';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta: string;
  opciones: ReadonlyArray<{ valor: string; texto: string }>;
};

/** Lista desplegable nativa: en el celular abre el selector del sistema. */
export function Selector({ etiqueta, opciones, className, id, ...resto }: Props) {
  const generado = useId();
  const campoId = id ?? generado;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={campoId} className="text-sm font-bold text-ink">
        {etiqueta}
      </label>
      <select
        id={campoId}
        {...resto}
        className="min-h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-brand"
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
