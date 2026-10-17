import type { ScopedClient } from '../../infrastructure/database/prisma.service';
import { generarTokenOpaco, hashearTokenOpaco } from '../../infrastructure/crypto/tokens-opacos';

/** docs/07_SEGURIDAD_AUTH.md §2.3. */
export const VIGENCIA_INVITACION_MS = 72 * 60 * 60 * 1000;
export const VIGENCIA_RECUPERACION_MS = 60 * 60 * 1000;

export type Proposito = 'INVITACION' | 'RECUPERACION';

/**
 * Crea un enlace de un solo uso y anula los anteriores del mismo propósito, para
 * que solo valga el último correo enviado. Devuelve el token en claro, que solo
 * viaja en el correo; la base guarda su hash.
 */
export async function crearTokenUnUso(
  tx: ScopedClient,
  usuarioId: string,
  proposito: Proposito,
): Promise<string> {
  await tx.tokenUnUso.deleteMany({ where: { usuarioId, proposito, usadoAt: null } });
  const token = generarTokenOpaco();
  const vigencia = proposito === 'INVITACION' ? VIGENCIA_INVITACION_MS : VIGENCIA_RECUPERACION_MS;
  await tx.tokenUnUso.create({
    data: {
      usuarioId,
      proposito,
      tokenHash: hashearTokenOpaco(token),
      expiraAt: new Date(Date.now() + vigencia),
    },
  });
  return token;
}

/**
 * Marca el token como usado si es válido y devuelve su usuario; `null` si no
 * existe, venció o ya se usó. El reclamo es atómico: dos clics, un solo uso.
 */
export async function canjearTokenUnUso(
  tx: ScopedClient,
  token: string,
  proposito: Proposito,
): Promise<string | null> {
  const tokenHash = hashearTokenOpaco(token);
  const ahora = new Date();
  const canjeado = await tx.tokenUnUso.updateMany({
    where: { tokenHash, proposito, usadoAt: null, expiraAt: { gt: ahora } },
    data: { usadoAt: ahora },
  });
  if (canjeado.count === 0) return null;
  const registro = await tx.tokenUnUso.findUniqueOrThrow({ where: { tokenHash } });
  return registro.usuarioId;
}
