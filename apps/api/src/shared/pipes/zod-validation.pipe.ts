import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

import { ApiError } from '../errors/api-error';

/** Valida el cuerpo con un esquema de `@resto/contracts`; si falla, `400 VALIDATION_ERROR`. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const resultado = this.schema.safeParse(value);
    if (resultado.success) return resultado.data;

    throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'La solicitud no es válida.', {
      campos: resultado.error.issues.map((issue) => ({
        campo: issue.path.join('.'),
        mensaje: issue.message,
      })),
    });
  }
}
