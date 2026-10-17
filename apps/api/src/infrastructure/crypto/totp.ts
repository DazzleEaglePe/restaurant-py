import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Códigos TOTP de RFC 6238 (SHA-1, 30 s, 6 dígitos): los de Google Authenticator. */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PASO_S = 30;
const DIGITOS = 6;

export function codificarBase32(datos: Uint8Array): string {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of datos) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

export function decodificarBase32(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const caracter of limpio) {
    const indice = ALFABETO.indexOf(caracter);
    if (indice === -1) throw new Error('Secreto TOTP inválido.');
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Secreto nuevo de 160 bits en base32, para la app de autenticación. */
export function generarSecretoTotp(): string {
  return codificarBase32(randomBytes(20));
}

/** Código para un instante (RFC 6238 §4, truncado dinámico de RFC 4226 §5.3). */
export function codigoTotp(secreto: Buffer, instanteMs: number, digitos = DIGITOS): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(instanteMs / 1000 / PASO_S)));
  const hmac = createHmac('sha1', secreto).update(contador).digest();
  const desplazamiento = hmac[hmac.length - 1]! & 0x0f;
  const binario = hmac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(binario % 10 ** digitos).padStart(digitos, '0');
}

/** Acepta el código del paso actual y de los vecinos, por desfase del reloj del celular. */
export function verificarTotp(
  secretoBase32: string,
  codigo: string,
  ahoraMs = Date.now(),
): boolean {
  if (!/^\d{6}$/.test(codigo)) return false;
  const secreto = decodificarBase32(secretoBase32);
  return [-1, 0, 1].some((paso) =>
    timingSafeEqual(
      Buffer.from(codigoTotp(secreto, ahoraMs + paso * PASO_S * 1000)),
      Buffer.from(codigo),
    ),
  );
}

/** URI para el QR de la app de autenticación. */
export function uriTotp(secretoBase32: string, email: string, emisor = 'resto plataforma'): string {
  const etiqueta = encodeURIComponent(`${emisor}:${email}`);
  return `otpauth://totp/${etiqueta}?secret=${secretoBase32}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=6&period=30`;
}
