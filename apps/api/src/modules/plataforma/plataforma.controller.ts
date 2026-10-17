import {
  Body,
  Controller,
  createParamDecorator,
  type ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  crearNegocioPlataformaSchema,
  loginPlataformaSchema,
  type CrearNegocioPlataforma,
  type LoginPlataforma,
  type NegocioPlataforma,
  type SesionPlataforma,
} from '@resto/contracts';

import { Publico } from '../../shared/decorators/publico.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import {
  PlataformaIpGuard,
  PlataformaSesionGuard,
  type RequestPlataforma,
} from './plataforma.guards';
import { PlataformaService } from './plataforma.service';

const AdminPlataforma = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): string =>
    contexto.switchToHttp().getRequest<RequestPlataforma>().adminPlataformaId!,
);

// `@Publico()` deja fuera las guardas de sesión de los negocios; estas rutas
// tienen las suyas: lista de IPs y token de plataforma.
@Publico()
@Controller('platform/v1/auth')
@UseGuards(PlataformaIpGuard)
export class PlataformaAuthController {
  constructor(@Inject(PlataformaService) private readonly plataforma: PlataformaService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  ingresar(
    @Body(new ZodValidationPipe(loginPlataformaSchema)) cuerpo: LoginPlataforma,
  ): Promise<SesionPlataforma> {
    return this.plataforma.ingresar(cuerpo.email, cuerpo.password, cuerpo.totp);
  }
}

@Publico()
@Controller('platform/v1/negocios')
@UseGuards(PlataformaIpGuard, PlataformaSesionGuard)
export class PlataformaNegociosController {
  constructor(@Inject(PlataformaService) private readonly plataforma: PlataformaService) {}

  @Get()
  listar(): Promise<NegocioPlataforma[]> {
    return this.plataforma.listarNegocios();
  }

  @Post()
  crear(
    @AdminPlataforma() adminId: string,
    @Body(new ZodValidationPipe(crearNegocioPlataformaSchema)) datos: CrearNegocioPlataforma,
  ): Promise<NegocioPlataforma> {
    return this.plataforma.crearNegocio(adminId, datos);
  }

  @Post(':id/suspender')
  @HttpCode(HttpStatus.NO_CONTENT)
  suspender(
    @AdminPlataforma() adminId: string,
    @Param('id', new ParseUUIDPipe()) negocioId: string,
  ): Promise<void> {
    return this.plataforma.cambiarEstado(adminId, negocioId, 'SUSPENDIDO');
  }

  @Post(':id/reactivar')
  @HttpCode(HttpStatus.NO_CONTENT)
  reactivar(
    @AdminPlataforma() adminId: string,
    @Param('id', new ParseUUIDPipe()) negocioId: string,
  ): Promise<void> {
    return this.plataforma.cambiarEstado(adminId, negocioId, 'ACTIVO');
  }
}
