'use client';

import { Aviso, Boton, Campo, Mascota } from '@resto/ui/componentes';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { mensajeDeError } from '@/lib/errores';
import { useSesion } from '@/lib/sesion';

/** Ingreso del equipo con contraseña y código TOTP (docs/07_SEGURIDAD_AUTH.md §11). */
export default function Ingresar() {
  const { estado, ingresar } = useSesion();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (estado.tipo === 'activa') router.replace('/negocios');
  }, [estado, router]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await ingresar({ email: email.trim(), password, totp });
    } catch (problema) {
      setError(mensajeDeError(problema));
      // El código ya se usó o era errado: se pide uno nuevo.
      setTotp('');
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
        <Mascota estado="listo" tamano={56} />
        <div>
          <p className="font-titulo text-3xl text-brand">resto</p>
          <p className="text-sm text-muted">Consola de plataforma</p>
        </div>
      </header>
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <div>
          <h1 className="font-titulo text-2xl text-ink">Ingresa a la consola</h1>
          <p className="mt-1 text-muted">Solo para el equipo de resto, desde la VPN.</p>
        </div>
        {estado.tipo === 'vencida' && !error && (
          <Aviso>Pasaron 30 minutos y la sesión terminó. Ingresa de nuevo.</Aviso>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo
          etiqueta="Correo"
          type="email"
          autoComplete="username"
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
        <Campo
          etiqueta="Código de tu app de autenticación"
          ayuda="Los 6 dígitos que muestra ahora."
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          className="[&_input]:tracking-[0.3em] [&_input]:tabular-nums"
          value={totp}
          onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
        />
        <Boton
          type="submit"
          cargando={enviando}
          disabled={!email || !password || totp.length !== 6}
        >
          Ingresar
        </Boton>
      </form>
    </main>
  );
}
