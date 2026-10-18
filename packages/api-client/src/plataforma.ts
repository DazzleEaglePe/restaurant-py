import type {
  CrearNegocioPlataforma,
  LoginPlataforma,
  NegocioPlataforma,
  SesionPlataforma,
} from '@resto/contracts';

import { errorDeRespuesta, interpretarRespuesta } from './respuestas.js';

export type OpcionesClientePlataforma = {
  /** `NEXT_PUBLIC_API_URL`, sin `/platform/v1`. */
  baseUrl: string;
  /** Se llama cuando el token de 30 minutos venció: la consola vuelve al ingreso. */
  alExpirarSesion?: () => void;
  fetch?: typeof fetch;
};

/**
 * Cliente de `/platform/v1` para la consola interna (docs/06_API_CONTRACT.md §19).
 *
 * El token vive solo en memoria y no se renueva: a los 30 minutos, o al recargar
 * la página, se vuelve a ingresar con contraseña y TOTP (docs/07 §11). No usa
 * cookies, así que nunca manda credenciales del navegador.
 */
export class ClientePlataforma {
  private accessToken: string | null = null;
  private readonly fetch: typeof fetch;

  constructor(private readonly opciones: OpcionesClientePlataforma) {
    this.fetch = opciones.fetch ?? globalThis.fetch.bind(globalThis);
  }

  get tieneSesion(): boolean {
    return this.accessToken !== null;
  }

  async ingresar(datos: LoginPlataforma): Promise<SesionPlataforma> {
    const sesion = await this.solicitud<SesionPlataforma>('POST', '/platform/v1/auth/login', datos);
    this.accessToken = sesion.access_token;
    return sesion;
  }

  /** No hay cierre en el servidor: basta con olvidar el token. */
  salir(): void {
    this.accessToken = null;
  }

  readonly negocios = {
    listar: () => this.solicitud<NegocioPlataforma[]>('GET', '/platform/v1/negocios'),
    crear: (datos: CrearNegocioPlataforma) =>
      this.solicitud<NegocioPlataforma>('POST', '/platform/v1/negocios', datos),
    suspender: (id: string) =>
      this.solicitud<void>('POST', `/platform/v1/negocios/${id}/suspender`),
    reactivar: (id: string) =>
      this.solicitud<void>('POST', `/platform/v1/negocios/${id}/reactivar`),
  };

  private async solicitud<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
    const cabeceras: Record<string, string> = { Accept: 'application/json' };
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    if (this.accessToken) cabeceras.Authorization = `Bearer ${this.accessToken}`;
    const respuesta = await this.fetch(`${this.opciones.baseUrl}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      credentials: 'omit',
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });

    if (respuesta.status === 401 && this.accessToken) {
      this.accessToken = null;
      this.opciones.alExpirarSesion?.();
      throw await errorDeRespuesta(respuesta);
    }
    return interpretarRespuesta<T>(respuesta);
  }
}
