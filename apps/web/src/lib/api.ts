import { ClienteApi } from '@resto/api-client';

let alExpirar: () => void = () => {};

/** Único cliente de la API en la web; el token vive solo en su memoria. */
export const api = new ClienteApi({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001',
  alExpirarSesion: () => alExpirar(),
});

/** La sesión registra aquí qué hacer cuando ya no se puede renovar. */
export function alExpirarSesion(manejador: () => void): void {
  alExpirar = manejador;
}
