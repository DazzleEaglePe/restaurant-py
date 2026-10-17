'use client';

import { Aviso, Boton, Campo } from '@resto/ui/componentes';
import { type FormEvent, useState } from 'react';

import { mensajeDeError } from '@/lib/errores';

const MINIMO = 10;

/**
 * Formulario de contraseña nueva para activar la cuenta o recuperarla. Las reglas
 * de docs/07_SEGURIDAD_AUTH.md §2.3 se revisan en la API; aquí, solo el largo y
 * que coincidan, para avisar antes de enviar.
 */
export function NuevaContrasena({
  titulo,
  descripcion,
  accion,
  alGuardar,
}: {
  titulo: string;
  descripcion: string;
  accion: string;
  alGuardar: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errorCampo, setErrorCampo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (password.length < MINIMO) return setErrorCampo(`Usa al menos ${MINIMO} caracteres.`);
    if (password !== confirmacion) return setErrorCampo('Las dos contraseñas no coinciden.');
    setErrorCampo(undefined);
    setEnviando(true);
    try {
      await alGuardar(password);
    } catch (problema) {
      setError(mensajeDeError(problema));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="font-titulo text-2xl text-ink">{titulo}</h1>
        <p className="mt-1 text-muted">{descripcion}</p>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo
        etiqueta="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        ayuda="Al menos 10 caracteres. Evita las que todos usan, como 1234567890."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Campo
        etiqueta="Repite la contraseña"
        type="password"
        autoComplete="new-password"
        error={errorCampo}
        value={confirmacion}
        onChange={(e) => setConfirmacion(e.target.value)}
      />
      <Boton type="submit" cargando={enviando} disabled={!password || !confirmacion}>
        {accion}
      </Boton>
    </form>
  );
}
