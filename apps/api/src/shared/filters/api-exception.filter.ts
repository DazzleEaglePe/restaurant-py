import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ErrorResponse } from '@resto/contracts';
import type { Response } from 'express';

import { ApiError } from '../errors/api-error';

/** Código del catálogo para las excepciones que lanza Nest por su cuenta. */
const CODIGO_POR_ESTADO: Partial<Record<number, { code: string; message: string }>> = {
  [HttpStatus.BAD_REQUEST]: { code: 'VALIDATION_ERROR', message: 'La solicitud no es válida.' },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHENTICATED', message: 'Inicia sesión para continuar.' },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'No tienes permiso para esta acción.' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'No encontramos lo que buscas.' },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.',
  },
};

/** Todo error sale con el formato de docs/06_API_CONTRACT.md §1.3. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = String(res.locals.requestId ?? '');

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: Omit<ErrorResponse['error'], 'request_id'> = {
      code: 'INTERNAL_ERROR',
      message: 'Algo salió mal. Intenta de nuevo.',
    };

    if (exception instanceof ApiError) {
      status = exception.status;
      error = { code: exception.code, message: exception.message, details: exception.details };
      for (const [nombre, valor] of Object.entries(exception.headers ?? {})) {
        res.setHeader(nombre, valor);
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      error = CODIGO_POR_ESTADO[status] ?? { code: 'HTTP_ERROR', message: exception.message };
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const cuerpo: ErrorResponse = { error: { ...error, request_id: requestId } };
    res.status(status).json(cuerpo);
  }
}
