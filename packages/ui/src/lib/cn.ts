import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases condicionales y resuelve los conflictos de Tailwind. */
export function cn(...clases: ClassValue[]): string {
  return twMerge(clsx(clases));
}
