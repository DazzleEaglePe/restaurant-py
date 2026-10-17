import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  cambiarNegocioSchema,
  loginRequestSchema,
  type CambiarNegocio,
  type LoginRequest,
  type MeResponse,
  type SesionResponse,
} from '@resto/contracts';
import type { Request, Response } from 'express';

import type { Environment } from '../../config/env.schema';
import { Publico } from '../../shared/decorators/publico.decorator';
import { type Sesion, SesionActual } from '../../shared/decorators/sesion.decorator';
import { noAutenticado } from '../../shared/errors/api-error';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { AuthService, VIGENCIA_REFRESH_MS } from './auth.service';

export const COOKIE_REFRESH = 'resto_refresh';

/** docs/06_API_CONTRACT.md §2. */
@Controller()
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  // RNF-SEG-007: además del bloqueo por cuenta, un límite por IP.
  @Publico()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) cuerpo: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionResponse> {
    const { respuesta, refreshToken } = await this.auth.ingresar(cuerpo.email, cuerpo.password);
    this.ponerCookie(res, refreshToken);
    return respuesta;
  }

  @Publico()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionResponse> {
    const token = this.leerCookie(req);
    if (!token) throw noAutenticado();
    try {
      const { respuesta, refreshToken } = await this.auth.renovar(token);
      this.ponerCookie(res, refreshToken);
      return respuesta;
    } catch (error) {
      // Una cookie que ya no sirve se borra para que la web vaya al ingreso.
      this.borrarCookie(res);
      throw error;
    }
  }

  @Publico()
  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = this.leerCookie(req);
    if (token) await this.auth.cerrarSesion(token);
    this.borrarCookie(res);
  }

  @Post('auth/switch-tenant')
  @HttpCode(HttpStatus.OK)
  async cambiarNegocio(
    @SesionActual() sesion: Sesion,
    @Body(new ZodValidationPipe(cambiarNegocioSchema)) cuerpo: CambiarNegocio,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionResponse> {
    const token = this.leerCookie(req);
    if (!token) throw noAutenticado();
    const { respuesta, refreshToken } = await this.auth.cambiarNegocio(
      sesion,
      token,
      cuerpo.tenant_id,
    );
    this.ponerCookie(res, refreshToken);
    return respuesta;
  }

  @Get('me')
  me(@SesionActual() sesion: Sesion): Promise<MeResponse> {
    return this.auth.yo(sesion);
  }

  private leerCookie(req: Request): string | undefined {
    const valor: unknown = req.cookies?.[COOKIE_REFRESH];
    return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
  }

  /** docs/07_SEGURIDAD_AUTH.md §2.2: `HttpOnly; Secure; SameSite=Strict`, y solo
   * viaja a las rutas de sesión. */
  private opcionesCookie() {
    return {
      httpOnly: true,
      // http://localhost en desarrollo; Secure en todo lo demás.
      secure: this.config.get('NODE_ENV', { infer: true }) !== 'development',
      sameSite: 'strict' as const,
      path: '/v1/auth',
    };
  }

  private ponerCookie(res: Response, token: string): void {
    res.cookie(COOKIE_REFRESH, token, { ...this.opcionesCookie(), maxAge: VIGENCIA_REFRESH_MS });
  }

  private borrarCookie(res: Response): void {
    res.clearCookie(COOKIE_REFRESH, this.opcionesCookie());
  }
}
