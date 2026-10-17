import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  UseGuards,
} from '@nestjs/common';

import { LocalGuard, type RequestConLocal } from '../guards/local.guard';

/** La ruta opera sobre el local de `X-Local-Id`, que el usuario debe tener asignado. */
export const OperaEnLocal = () => applyDecorators(UseGuards(LocalGuard));

/** El local validado por `@OperaEnLocal()`. */
export const LocalActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): string => {
    const localId = contexto.switchToHttp().getRequest<RequestConLocal>().localId;
    if (!localId) throw new Error('LocalActual en una ruta sin @OperaEnLocal().');
    return localId;
  },
);
