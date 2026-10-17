import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `X-Request-Id` en toda respuesta (docs/06_API_CONTRACT.md §1.2). Respeta el del
 * proxy si es un UUID; si no, genera uno. El filtro de errores lo repite en el cuerpo.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const recibido = req.header('x-request-id');
  const requestId = recibido && UUID.test(recibido) ? recibido : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
