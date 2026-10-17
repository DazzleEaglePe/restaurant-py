import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn.js';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children: ReactNode };

/** Casilla con la fila entera tocable: 48 px de alto (docs/09 §5.2). */
export function Casilla({ children, className, ...resto }: Props) {
  return (
    <label
      className={cn(
        'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 font-semibold text-ink',
        'has-[:checked]:border-brand has-[:checked]:bg-soft',
        className,
      )}
    >
      <input type="checkbox" {...resto} className="size-5 accent-[var(--color-brand)]" />
      {children}
    </label>
  );
}
