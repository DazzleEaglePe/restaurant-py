import { type InputHTMLAttributes, useId } from 'react';

import { cn } from '../lib/cn.js';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  /** Texto de ayuda bajo el campo. */
  ayuda?: string;
  /** Error del campo: se anuncia y el campo se sacude (docs/09 §9.4). */
  error?: string;
};

export function Campo({ etiqueta, ayuda, error, className, id, ...resto }: Props) {
  const generado = useId();
  const campoId = id ?? generado;
  const descripcion = error ? `${campoId}-error` : ayuda ? `${campoId}-ayuda` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={campoId} className="text-sm font-bold text-ink">
        {etiqueta}
      </label>
      <input
        id={campoId}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion}
        {...resto}
        // `key` cambia con el error para repetir la sacudida en cada intento.
        key={error}
        className={cn(
          'min-h-12 rounded-xl border bg-surface px-4 text-base text-ink placeholder:text-muted',
          'transition-colors duration-fast ease-standard focus:outline-none focus:ring-2 focus:ring-brand',
          error ? 'border-[#B42318] motion-safe:animate-sacudida' : 'border-line',
        )}
      />
      {error ? (
        <p id={`${campoId}-error`} role="alert" className="text-sm font-semibold text-[#B42318]">
          {error}
        </p>
      ) : ayuda ? (
        <p id={`${campoId}-ayuda`} className="text-sm text-muted">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
