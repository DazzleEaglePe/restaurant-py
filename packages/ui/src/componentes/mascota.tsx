import { cn } from '../lib/cn.js';

/** Estados de la mascota en las pantallas del sistema (docs/09_DESIGN_SYSTEM.md §15). */
export type EstadoMascota = 'cargando' | 'alerta' | 'reposo' | 'listo';

type Props = { estado?: EstadoMascota; tamano?: number; className?: string };

/**
 * La campana de servir de la marca Marino, con su «ding» (D26). Toma los colores
 * del tema, así que funciona en claro y en noche.
 */
export function Mascota({ estado = 'reposo', tamano = 112, className }: Props) {
  const ojos =
    estado === 'reposo' ? (
      // Ojos cerrados: dos arcos.
      <g stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M40 62 q5 4 10 0" />
        <path d="M70 62 q5 4 10 0" />
      </g>
    ) : (
      <g fill="var(--color-ink)">
        <circle cx="45" cy="61" r={estado === 'alerta' ? 4.5 : 3.5} />
        <circle cx="75" cy="61" r={estado === 'alerta' ? 4.5 : 3.5} />
      </g>
    );

  const boca =
    estado === 'alerta' ? (
      <ellipse cx="60" cy="74" rx="4" ry="3" fill="var(--color-ink)" />
    ) : estado === 'listo' ? (
      <path
        d="M52 71 q8 7 16 0"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    ) : (
      <path d="M54 73 h12" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
    );

  const ding = estado === 'listo' || estado === 'cargando' || estado === 'alerta';

  return (
    <svg
      viewBox="0 0 120 120"
      width={tamano}
      height={tamano}
      role="img"
      aria-label="Mascota de resto"
      className={cn(estado === 'cargando' && 'motion-safe:animate-flotar', className)}
    >
      {/* Rayas del «ding». */}
      {ding && (
        <g
          stroke="var(--color-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          className={cn(estado !== 'listo' && 'motion-safe:animate-latido')}
        >
          <path d="M92 22 l7 -7" />
          <path d="M99 34 l10 -2" />
          <path d="M84 14 l2 -10" />
        </g>
      )}
      {/* Perilla, campana y plato. */}
      <circle cx="60" cy="26" r="6" fill="var(--color-brand)" />
      <path d="M18 88 C18 52 36 32 60 32 C84 32 102 52 102 88 Z" fill="var(--color-brand)" />
      <path
        d="M32 82 C32 60 42 44 56 40"
        stroke="var(--color-soft)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <ellipse cx="60" cy="66" rx="30" ry="22" fill="var(--color-surface)" opacity="0.95" />
      {ojos}
      {boca}
      <rect x="10" y="88" width="100" height="10" rx="5" fill="var(--color-ink)" />
    </svg>
  );
}
