import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export function Tarjeta({ className, ...resto }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...resto}
      className={cn('rounded-2xl border border-line bg-surface p-5 shadow-sm', className)}
    />
  );
}
