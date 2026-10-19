import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  crearZonaSchema,
  editarZonaSchema,
  ordenarSchema,
  type CrearZona,
  type EditarZona,
  type Ordenar,
  type Zona,
} from '@resto/contracts';

import { LocalActual, OperaEnLocal } from '../../shared/decorators/local.decorator';
import { Roles, ROLES } from '../../shared/decorators/roles.decorator';
import { type Sesion, SesionActual } from '../../shared/decorators/sesion.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ZonasService } from './zonas.service';

const uuid = () => new ParseUUIDPipe();

/** docs/06_API_CONTRACT.md §7. */
@Controller()
export class ZonasController {
  constructor(@Inject(ZonasService) private readonly zonas: ZonasService) {}

  /** Zonas activas del local de `X-Local-Id`, para tomar un pedido o filtrar el salón. */
  @Get('zonas')
  @Roles(...ROLES.personal)
  @OperaEnLocal()
  activas(@SesionActual() sesion: Sesion, @LocalActual() localId: string): Promise<Zona[]> {
    return this.zonas.activas(sesion, localId);
  }

  @Get('locales/:id/zonas')
  @Roles(...ROLES.administracion)
  delLocal(@SesionActual() sesion: Sesion, @Param('id', uuid()) localId: string): Promise<Zona[]> {
    return this.zonas.delLocal(sesion, localId);
  }

  @Post('locales/:id/zonas')
  @Roles(...ROLES.administracion)
  crear(
    @SesionActual() sesion: Sesion,
    @Param('id', uuid()) localId: string,
    @Body(new ZodValidationPipe(crearZonaSchema)) datos: CrearZona,
  ): Promise<Zona> {
    return this.zonas.crear(sesion, localId, datos);
  }

  @Put('locales/:id/zonas/orden')
  @Roles(...ROLES.administracion)
  ordenar(
    @SesionActual() sesion: Sesion,
    @Param('id', uuid()) localId: string,
    @Body(new ZodValidationPipe(ordenarSchema)) datos: Ordenar,
  ): Promise<Zona[]> {
    return this.zonas.ordenar(sesion, localId, datos.ids);
  }

  @Patch('zonas/:id')
  @Roles(...ROLES.administracion)
  editar(
    @SesionActual() sesion: Sesion,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(editarZonaSchema)) cambios: EditarZona,
  ): Promise<Zona> {
    return this.zonas.editar(sesion, id, cambios);
  }
}
