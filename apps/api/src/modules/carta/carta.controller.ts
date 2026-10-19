import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import {
  crearCategoriaSchema,
  crearProductoSchema,
  editarCategoriaSchema,
  editarProductoSchema,
  ordenarSchema,
  productoEnLocalSchema,
  type Carta,
  type Categoria,
  type CrearCategoria,
  type CrearProducto,
  type EditarCategoria,
  type EditarProducto,
  type Ordenar,
  type Producto,
  type ProductoEnLocal,
} from '@resto/contracts';
import type { Response } from 'express';

import { LocalActual, OperaEnLocal } from '../../shared/decorators/local.decorator';
import { Roles, ROLES } from '../../shared/decorators/roles.decorator';
import { type Sesion, SesionActual } from '../../shared/decorators/sesion.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { CartaService } from './carta.service';

const uuid = () => new ParseUUIDPipe();

/** docs/06_API_CONTRACT.md §6. */
@Controller()
export class CartaController {
  constructor(@Inject(CartaService) private readonly carta: CartaService) {}

  /**
   * La carta del local de `X-Local-Id`. Con `If-None-Match` igual a la versión
   * responde `304` sin cuerpo, para que la caja no la descargue de nuevo.
   */
  @Get('carta')
  @Roles(...ROLES.caja)
  @OperaEnLocal()
  async obtener(
    @SesionActual() sesion: Sesion,
    @LocalActual() localId: string,
    @Headers('if-none-match') siNoCoincide: string | undefined,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<Carta | undefined> {
    const carta = await this.carta.carta(sesion, localId);
    const etag = `"${carta.version}"`;
    respuesta.setHeader('ETag', etag);
    respuesta.setHeader('Cache-Control', 'private, no-cache');
    if (siNoCoincide === etag) {
      respuesta.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }
    return carta;
  }

  // --- Categorías ------------------------------------------------------------

  @Get('categorias')
  @Roles(...ROLES.administracion)
  listarCategorias(@SesionActual() sesion: Sesion): Promise<Categoria[]> {
    return this.carta.listarCategorias(sesion);
  }

  @Post('categorias')
  @Roles(...ROLES.administracion)
  crearCategoria(
    @SesionActual() sesion: Sesion,
    @Body(new ZodValidationPipe(crearCategoriaSchema)) datos: CrearCategoria,
  ): Promise<Categoria> {
    return this.carta.crearCategoria(sesion, datos);
  }

  @Put('categorias/orden')
  @Roles(...ROLES.administracion)
  ordenarCategorias(
    @SesionActual() sesion: Sesion,
    @Body(new ZodValidationPipe(ordenarSchema)) datos: Ordenar,
  ): Promise<Categoria[]> {
    return this.carta.ordenarCategorias(sesion, datos.ids);
  }

  @Patch('categorias/:id')
  @Roles(...ROLES.administracion)
  editarCategoria(
    @SesionActual() sesion: Sesion,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(editarCategoriaSchema)) cambios: EditarCategoria,
  ): Promise<Categoria> {
    return this.carta.editarCategoria(sesion, id, cambios);
  }

  // --- Productos y combos ----------------------------------------------------

  @Get('productos')
  @Roles(...ROLES.administracion)
  listarProductos(@SesionActual() sesion: Sesion): Promise<Producto[]> {
    return this.carta.listarProductos(sesion);
  }

  @Post('productos')
  @Roles(...ROLES.administracion)
  crearProducto(
    @SesionActual() sesion: Sesion,
    @Body(new ZodValidationPipe(crearProductoSchema)) datos: CrearProducto,
  ): Promise<Producto> {
    return this.carta.crearProducto(sesion, datos);
  }

  @Put('productos/orden')
  @Roles(...ROLES.administracion)
  ordenarProductos(
    @SesionActual() sesion: Sesion,
    @Body(new ZodValidationPipe(ordenarSchema)) datos: Ordenar,
  ): Promise<Producto[]> {
    return this.carta.ordenarProductos(sesion, datos.ids);
  }

  @Patch('productos/:id')
  @Roles(...ROLES.administracion)
  editarProducto(
    @SesionActual() sesion: Sesion,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(editarProductoSchema)) cambios: EditarProducto,
  ): Promise<Producto> {
    return this.carta.editarProducto(sesion, id, cambios);
  }

  @Put('productos/:id/locales/:localId')
  @Roles(...ROLES.administracion)
  configurarEnLocal(
    @SesionActual() sesion: Sesion,
    @Param('id', uuid()) id: string,
    @Param('localId', uuid()) localId: string,
    @Body(new ZodValidationPipe(productoEnLocalSchema)) datos: ProductoEnLocal,
  ): Promise<Producto> {
    return this.carta.configurarEnLocal(sesion, id, localId, datos);
  }

  @Post('productos/:id/agotado')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ROLES.caja)
  @OperaEnLocal()
  marcarAgotado(
    @SesionActual() sesion: Sesion,
    @LocalActual() localId: string,
    @Param('id', uuid()) id: string,
  ): Promise<void> {
    return this.carta.marcarAgotado(sesion, id, localId, true);
  }

  @Delete('productos/:id/agotado')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ROLES.caja)
  @OperaEnLocal()
  quitarAgotado(
    @SesionActual() sesion: Sesion,
    @LocalActual() localId: string,
    @Param('id', uuid()) id: string,
  ): Promise<void> {
    return this.carta.marcarAgotado(sesion, id, localId, false);
  }
}
