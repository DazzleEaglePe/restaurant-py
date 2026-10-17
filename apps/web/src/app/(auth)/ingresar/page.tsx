'use client';

import { Aviso, Boton, Campo } from '@resto/ui/componentes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { destinoInicial } from '@/lib/destinos';
import { mensajeDeError } from '@/lib/errores';
import { leerLocal } from '@/lib/local';
import { useSesion } from '@/lib/sesion';

export default function Ingresar() {
  const { estado, ingresar } = useSesion();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Con una sesión ya abierta no hace falta volver a ingresar.
  useEffect(() => {
    if (estado.tipo === 'activa') {
      router.replace(destinoInicial(estado.sesion, leerLocal(estado.sesion.user.id)));
    }
  }, [estado, router]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await ingresar(email.trim(), password);
    } catch (problema) {
      setError(mensajeDeError(problema));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="font-titulo text-2xl text-ink">Ingresa a tu cuenta</h1>
        <p className="mt-1 text-muted">Con el correo y la contraseña de tu invitación.</p>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo
        etiqueta="Correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Campo
        etiqueta="Contraseña"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Boton type="submit" cargando={enviando} disabled={!email || !password}>
        Ingresar
      </Boton>
      <Link
        href="/recuperar"
        className="text-center text-sm font-bold text-brand underline-offset-4 hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
