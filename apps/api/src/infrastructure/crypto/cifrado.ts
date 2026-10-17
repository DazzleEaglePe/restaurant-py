import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM con la `ENCRYPTION_KEY` (32 bytes en base64): secretos TOTP, y más
 * adelante la clave de Yallegó y los nombres de pagadores (docs/07_SEGURIDAD_AUTH.md
 * §6.1). Formato: iv (12 bytes) · etiqueta (16 bytes) · texto cifrado.
 */
export class Cifrador {
  private readonly clave: Buffer;

  constructor(claveBase64: string) {
    this.clave = Buffer.from(claveBase64, 'base64');
    if (this.clave.length !== 32) {
      throw new Error('ENCRYPTION_KEY debe tener 32 bytes en base64.');
    }
  }

  /** Devuelve bytes listos para una columna `bytea`. */
  cifrar(texto: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(12);
    const cifrador = createCipheriv('aes-256-gcm', this.clave, iv);
    const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
    return new Uint8Array(Buffer.concat([iv, cifrador.getAuthTag(), cifrado]));
  }

  /** Lanza si el dato fue alterado o se cifró con otra clave. */
  descifrar(datos: Uint8Array): string {
    const buffer = Buffer.from(datos);
    const descifrador = createDecipheriv('aes-256-gcm', this.clave, buffer.subarray(0, 12));
    descifrador.setAuthTag(buffer.subarray(12, 28));
    return Buffer.concat([descifrador.update(buffer.subarray(28)), descifrador.final()]).toString(
      'utf8',
    );
  }
}
