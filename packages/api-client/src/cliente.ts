import type {
  CrearLocal,
  EditarLocal,
  EditarMiembro,
  EditarNegocio,
  InvitarMiembro,
  Local,
  MeResponse,
  Miembro,
  Negocio,
  SesionResponse,
} from '@resto/contracts';

import { errorDeRespuesta, interpretarRespuesta } from './respuestas.js';

export type OpcionesCliente = {
  /** `NEXT_PUBLIC_API_URL`, sin `/v1`. */
  baseUrl: string;
  /** Se llama cuando la sesión no se pudo renovar: la web muestra «Tu sesión terminó». */
  alExpirarSesion?: () => void;
  fetch?: typeof fetch;
};

type Solicitud = {
  cuerpo?: unknown;
  /** Local de la operación (`X-Local-Id`, docs/06 §1.2). */
  localId?: string;
};

/** Rutas que no deben provocar una renovación al responder 401. */
const RUTAS_DE_SESION = /^\/v1\/auth\//;

/**
 * Cliente de la API para la web (docs/11_ESTRUCTURA_PROYECTO.md §6.4).
 *
 * El access token vive solo en memoria (docs/07_SEGURIDAD_AUTH.md §2.2); el
 * refresh token, en la cookie `HttpOnly` que el navegador manda solo. Si una
 * solicitud responde 401, renueva una sola vez —aunque lleguen varias a la vez—
 * y la repite.
 */
export class ClienteApi {
  private accessToken: string | null = null;
  private renovacion: Promise<SesionResponse | null> | null = null;
  private readonly fetch: typeof fetch;

  constructor(private readonly opciones: OpcionesCliente) {
    this.fetch = opciones.fetch ?? globalThis.fetch.bind(globalThis);
  }

  get tieneSesion(): boolean {
    return this.accessToken !== null;
  }

  // --- Sesión -------------------------------------------------------------

  async ingresar(email: string, password: string): Promise<SesionResponse> {
    return this.guardarSesion(
      await this.solicitud<SesionResponse>('POST', '/v1/auth/login', {
        cuerpo: { email, password },
      }),
    );
  }

  /** Recupera la sesión desde la cookie. `null` si no hay o ya venció. */
  renovar(): Promise<SesionResponse | null> {
    this.renovacion ??= this.solicitud<SesionResponse>('POST', '/v1/auth/refresh')
      .then((sesion) => this.guardarSesion(sesion))
      .catch(() => {
        this.accessToken = null;
        return null;
      })
      .finally(() => {
        this.renovacion = null;
      });
    return this.renovacion;
  }

  async cerrarSesion(): Promise<void> {
    try {
      await this.solicitud<void>('POST', '/v1/auth/logout');
    } finally {
      this.accessToken = null;
    }
  }

  async aceptarInvitacion(token: string, password: string): Promise<SesionResponse> {
    return this.guardarSesion(
      await this.solicitud<SesionResponse>('POST', '/v1/auth/invitations/accept', {
        cuerpo: { token, password },
      }),
    );
  }

  olvideContrasena(email: string): Promise<void> {
    return this.solicitud('POST', '/v1/auth/password/forgot', { cuerpo: { email } });
  }

  restablecerContrasena(token: string, password: string): Promise<void> {
    return this.solicitud('POST', '/v1/auth/password/reset', { cuerpo: { token, password } });
  }

  async cambiarNegocio(tenantId: string): Promise<SesionResponse> {
    return this.guardarSesion(
      await this.solicitud<SesionResponse>('POST', '/v1/auth/switch-tenant', {
        cuerpo: { tenant_id: tenantId },
      }),
    );
  }

  yo(): Promise<MeResponse> {
    return this.solicitud('GET', '/v1/me');
  }

  // --- Negocio y locales (docs/06 §3) --------------------------------------

  readonly negocio = {
    obtener: () => this.solicitud<Negocio>('GET', '/v1/negocio'),
    editar: (cambios: EditarNegocio) =>
      this.solicitud<Negocio>('PATCH', '/v1/negocio', { cuerpo: cambios }),
  };

  readonly locales = {
    listar: () => this.solicitud<Local[]>('GET', '/v1/locales'),
    actual: (localId: string) => this.solicitud<Local>('GET', '/v1/locales/actual', { localId }),
    crear: (datos: CrearLocal) => this.solicitud<Local>('POST', '/v1/locales', { cuerpo: datos }),
    editar: (id: string, cambios: EditarLocal) =>
      this.solicitud<Local>('PATCH', `/v1/locales/${id}`, { cuerpo: cambios }),
  };

  // --- Equipo (docs/06 §4) -------------------------------------------------

  readonly usuarios = {
    listar: () => this.solicitud<Miembro[]>('GET', '/v1/usuarios'),
    invitar: (datos: InvitarMiembro) =>
      this.solicitud<Miembro>('POST', '/v1/usuarios/invitaciones', { cuerpo: datos }),
    editar: (id: string, cambios: EditarMiembro) =>
      this.solicitud<Miembro>('PATCH', `/v1/usuarios/${id}`, { cuerpo: cambios }),
    reenviarInvitacion: (id: string) =>
      this.solicitud<void>('POST', `/v1/usuarios/${id}/invitacion`),
  };

  // --- Transporte ----------------------------------------------------------

  private guardarSesion(sesion: SesionResponse): SesionResponse {
    this.accessToken = sesion.access_token;
    return sesion;
  }

  private async solicitud<T>(metodo: string, ruta: string, opciones: Solicitud = {}): Promise<T> {
    const respuesta = await this.enviar(metodo, ruta, opciones);

    if (respuesta.status === 401 && this.accessToken && !RUTAS_DE_SESION.test(ruta)) {
      const sesion = await this.renovar();
      if (!sesion) {
        this.opciones.alExpirarSesion?.();
        throw await errorDeRespuesta(respuesta);
      }
      return interpretarRespuesta<T>(await this.enviar(metodo, ruta, opciones));
    }
    return interpretarRespuesta<T>(respuesta);
  }

  private enviar(metodo: string, ruta: string, { cuerpo, localId }: Solicitud): Promise<Response> {
    const cabeceras: Record<string, string> = { Accept: 'application/json' };
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    if (this.accessToken) cabeceras.Authorization = `Bearer ${this.accessToken}`;
    if (localId) cabeceras['X-Local-Id'] = localId;
    return this.fetch(`${this.opciones.baseUrl}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      // La cookie del refresh token viaja sola; el resto de credenciales, nunca.
      credentials: 'include',
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  }
}
