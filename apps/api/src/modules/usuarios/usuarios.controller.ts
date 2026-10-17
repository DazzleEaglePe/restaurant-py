import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { editarMiembroSchema, type EditarMiembro, type Miembro } from '@resto/contracts';

import { Roles, ROLES } from '../../shared/decorators/roles.decorator';
import { type Sesion, SesionActual } from '../../shared/decorators/sesion.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { UsuariosService } from './usuarios.service';

/** docs/06_API_CONTRACT.md §4. Las invitaciones llegan con los correos (#7). */
@Controller('usuarios')
@Roles(...ROLES.administracion)
export class UsuariosController {
  constructor(@Inject(UsuariosService) private readonly usuarios: UsuariosService) {}

  @Get()
  listar(@SesionActual() sesion: Sesion): Promise<Miembro[]> {
    return this.usuarios.listar(sesion);
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
