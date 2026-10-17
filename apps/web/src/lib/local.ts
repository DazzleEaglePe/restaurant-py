/**
 * Local elegido en este equipo, por usuario. Es una preferencia del navegador:
 * si se pierde, la persona vuelve a elegir. Nunca guarda tokens.
 */
const clave = (usuarioId: string) => `resto.local.${usuarioId}`;

export function leerLocal(usuarioId: string): string | null {
  try {
    return localStorage.getItem(clave(usuarioId));
  } catch {
    return null;
  }
}

export function guardarLocal(usuarioId: string, localId: string): void {
  try {
    localStorage.setItem(clave(usuarioId), localId);
  } catch {
    // Sin almacenamiento (modo privado): se vuelve a preguntar la próxima vez.
  }
}
