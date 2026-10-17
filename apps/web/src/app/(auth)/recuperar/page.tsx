'use client';

import { Aviso, Boton, Campo } from '@resto/ui/componentes';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';

import { api } from '@/lib/api';
import { mensajeDeError } from '@/lib/errores';

import { NuevaContrasena } from '../nueva-contrasena';

/** Pide el correo de recuperación (RF-AUTH-004). */
function PedirEnlace() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api.olvideContrasena(email.trim());
      setEnviado(true);
    } catch (problema) {
      setError(mensajeDeError(problema));
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    // El mismo mensaje exista o no la cuenta: no revela quién está registrado.
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-titulo text-2xl text-ink">Revisa tu correo</h1>
        <Aviso tipo="exito">
          Si {email} tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Vence
          en 60 minutos.
        </Aviso>
        <Link href="/ingresar" className="text-center font-bold text-brand">
          Volver al ingreso
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="font-titulo text-2xl text-ink">Recupera tu contraseña</h1>
        <p className="mt-1 text-muted">Te enviamos un enlace para crear una nueva.</p>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo
        etiqueta="Correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Boton type="submit" cargando={enviando} disabled={!email}>
        Enviar enlace
      </Boton>
      <Link href="/ingresar" className="text-center text-sm font-bold text-brand">
        Volver al ingreso
      </Link>
    </form>
  );
}

/** Con el token del correo, define la contraseña nueva. */
function Restablecer({ token }: { token: string }) {
  const [listo, setListo] = useState(false);

  if (listo) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-titulo text-2xl text-ink">Contraseña actualizada</h1>
        <Aviso tipo="exito">
          Ya puedes ingresar con tu contraseña nueva. Cerramos tus sesiones anteriores por
          seguridad.
        </Aviso>
        <Link
          href="/ingresar"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 font-bold text-white"
        >
          Ingresar
        </Link>
      </div>
    );
  }

  return (
    <>
      <NuevaContrasena
        titulo="Crea una contraseña nueva"
        descripcion="Al guardarla se cierran tus otras sesiones."
        accion="Guardar contraseña"
        alGuardar={async (password) => {
          await api.restablecerContrasena(token, password);
          setListo(true);
        }}
      />
      {/* Si el enlace venció, la persona pide otro sin volver al correo. */}
      <Link href="/recuperar" className="text-center text-sm font-bold text-brand">
        Pedir otro enlace
      </Link>
    </>
  );
}

function Recuperar() {
  const token = useSearchParams().get('token');
  return token ? <Restablecer token={token} /> : <PedirEnlace />;
}

export default function PaginaRecuperar() {
  return (
    <Suspense>
      <Recuperar />
    </Suspense>
  );
}
