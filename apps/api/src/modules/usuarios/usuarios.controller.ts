import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  editarMiembroSchema,
  invitarMiembroSchema,
  type EditarMiembro,
  type InvitarMiembro,
  type Miembro,
} from '@resto/contracts';

import { Roles, ROLES } from '../../shared/decorators/roles.decorator';
import { type Sesion, SesionActual } from '../../shared/decorators/sesion.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { UsuariosService } from './usuarios.service';

/** docs/06_API_CONTRACT.md §4. */
@Controller('usuarios')
@Roles(...ROLES.administracion)
export class UsuariosController {
  constructor(@Inject(UsuariosService) private readonly usuarios: UsuariosService) {}

  @Get()
  listar(@SesionActual() sesion: Sesion): Promise<Miembro[]> {
    return this.usuarios.listar(sesion);
  }

  @Post('invitaciones')
  invitar(
    @SesionActual() sesion: Sesion,
    @Body(new ZodValidationPipe(invitarMiembroSchema)) datos: InvitarMiembro,
  ): Promise<Miembro> {
    return this.usuarios.invitar(sesion, datos);
  }

  @Post(':id/invitacion')
  @HttpCode(HttpStatus.NO_CONTENT)
  reenviarInvitacion(
    @SesionActual() sesion: Sesion,
    @Param('id', new ParseUUIDPipe()) usuarioId: string,
  ): Promise<void> {
    return this.usuarios.reenviarInvitacion(sesion, usuarioId);
  }

  @Patch(':id')
  editar(
    @SesionActual() sesion: Sesion,
    @Param('id', new ParseUUIDPipe()) usuarioId: string,
    @Body(new ZodValidationPipe(editarMiembroSchema)) cambios: EditarMiembro,
  ): Promise<Miembro> {
    return this.usuarios.editar(sesion, usuarioId, cambios);
  }
}
