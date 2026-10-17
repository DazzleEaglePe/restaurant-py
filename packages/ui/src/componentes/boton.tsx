import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  /** Muestra un indicador y bloquea el botón mientras se espera la respuesta. */
  cargando?: boolean;
};

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-brand text-white hover:opacity-95',
  secundario: 'border border-line bg-surface text-ink hover:bg-soft',
  fantasma: 'text-brand hover:bg-soft',
  peligro: 'border border-line bg-surface text-[#B42318] hover:bg-[#FEF3F2]',
};

/** docs/09_DESIGN_SYSTEM.md §5.2 y §9.4: 48 px de alto y se hunde a 97 % al tocarlo. */
export function Boton({
  variante = 'primario',
  cargando,
  className,
  disabled,
  children,
  ...resto
}: Props) {
  return (
    <button
      type="button"
      {...resto}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold',
        'transition-transform duration-instant ease-standard active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        ESTILOS[variante],
        className,
      )}
    >
      {cargando && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
