import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'resto:publico';

/** La ruta no exige access token. Todo lo demás lo exige por omisión. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
