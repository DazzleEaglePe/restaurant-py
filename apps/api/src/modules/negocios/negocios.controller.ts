import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  crearLocalSchema,
  editarLocalSchema,
  editarNegocioSchema,
  type CrearLocal,
  type EditarLocal,
  type EditarNegocio,
  type Local,
  type Negocio,
} from '@resto/contracts';

import { LocalActual, OperaEnLocal } from '../../shared/decorators/local.decorator';
import { Roles, ROLES } from '../../shared/decorators/roles.decorator';
import { type Sesion, SesionActual } from '../../shared/decorators/sesion.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { NegociosService } from './negocios.service';

/** docs/06_API_CONTRACT.md §3. */
@Controller()
export class NegociosController {
  constructor(@Inject(NegociosService) private readonly negocios: NegociosService) {}

  @Get('negocio')
  @Roles(...ROLES.administracion)
  obtenerNegocio(@SesionActual() sesion: Sesion): Promise<Negocio> {
    return this.negocios.obtenerNegocio(sesion);
  }

  @Patch('negocio')
  @Roles('OWNER')
  editarNegocio(
    @SesionActual() sesion: Sesion,
    @Body(new ZodValidationPipe(editarNegocioSchema)) cambios: EditarNegocio,
  ): Promise<Negocio> {
    return this.negocios.editarNegocio(sesion, cambios);
  }

  @Get('locales')
  @Roles(...ROLES.personal)
  listarLocales(@SesionActual() sesion: Sesion): Promise<Local[]> {
    return this.negocios.listarLocales(sesion);
  }

  /** El local en el que opera la caja o el salón, con su configuración. */
  @Get('locales/actual')
  @Roles(...ROLES.personal)
  @OperaEnLocal()
  localActual(@SesionActual() sesion: Sesion, @LocalActual() localId: string): Promise<Local> {
    return this.negocios.obtenerLocal(sesion, localId);
  }

  @Post('locales')
  @Roles(...ROLES.administracion)
  crearLocal(
    @SesionActual() sesion: Sesion,
    @Body(new ZodValidationPipe(crearLocalSchema)) datos: CrearLocal,
  ): Promise<Local> {
    return this.negocios.crearLocal(sesion, datos);
  }

  @Patch('locales/:id')
  @Roles(...ROLES.administracion)
  editarLocal(
    @SesionActual() sesion: Sesion,
    @Param('id', new ParseUUIDPipe()) localId: string,
    @Body(new ZodValidationPipe(editarLocalSchema)) cambios: EditarLocal,
  ): Promise<Local> {
    return this.negocios.editarLocal(sesion, localId, cambios);
  }
}
