import { ClientePlataforma } from '@resto/api-client';

let alExpirar: () => void = () => {};

/** Único cliente de `/platform/v1` en la consola; el token vive solo en su memoria. */
export const api = new ClientePlataforma({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001',
  alExpirarSesion: () => alExpirar(),
});

/** La sesión registra aquí qué hacer cuando la API ya no acepta el token. */
export function alExpirarSesion(manejador: () => void): void {
  alExpirar = manejador;
}
