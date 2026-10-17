'use client';

import type { Negocio } from '@resto/contracts';
import { Aviso, Boton, Campo, Tarjeta } from '@resto/ui/componentes';
import { type FormEvent, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { mensajeDeError } from '@/lib/errores';
import { useSesionAdmin } from '@/lib/sesion-admin';

const COLOR_DEFECTO = '#FF6B57';

/**
 * Datos del negocio (docs/06_API_CONTRACT.md §3). El color de acento aparece en la
 * pantalla pública con el sello «con resto» (docs/09 §2.2). Solo el OWNER edita.
 */
export default function NegocioPagina() {
  const sesion = useSesionAdmin();
  const esDueno = sesion.rol === 'OWNER';
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [formulario, setFormulario] = useState({
    nombre_comercial: '',
    razon_social: '',
    ruc: '',
    color_acento: COLOR_DEFECTO,
  });
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargarFormulario = (datos: Negocio) => {
    setNegocio(datos);
    setFormulario({
      nombre_comercial: datos.nombre_comercial,
      razon_social: datos.razon_social ?? '',
      ruc: datos.ruc ?? '',
      color_acento: datos.color_acento ?? COLOR_DEFECTO,
    });
  };

  useEffect(() => {
    api.negocio.obtener().then(cargarFormulario, (problema) => setError(mensajeDeError(problema)));
  }, []);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      cargarFormulario(
        await api.negocio.editar({
          nombre_comercial: formulario.nombre_comercial.trim(),
          razon_social: formulario.razon_social.trim() || null,
          ruc: formulario.ruc.trim() || null,
          color_acento: formulario.color_acento.toUpperCase(),
        }),
      );
      setGuardado(true);
    } catch (problema) {
      setError(mensajeDeError(problema));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <h1 className="font-titulo text-2xl text-ink">Negocio</h1>
      {!esDueno && (
        <Aviso tipo="info">Solo el dueño puede cambiar estos datos. Tú puedes verlos.</Aviso>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {guardado && <Aviso tipo="exito">Datos del negocio guardados.</Aviso>}
      {negocio && (
        <form onSubmit={guardar}>
          <Tarjeta className="flex flex-col gap-4">
            <fieldset disabled={!esDueno} className="flex flex-col gap-4">
              <Campo
                etiqueta="Nombre comercial"
                value={formulario.nombre_comercial}
                onChange={(e) => setFormulario({ ...formulario, nombre_comercial: e.target.value })}
              />
              <Campo
                etiqueta="Razón social (opcional)"
                value={formulario.razon_social}
                onChange={(e) => setFormulario({ ...formulario, razon_social: e.target.value })}
              />
              <Campo
                etiqueta="RUC (opcional)"
                inputMode="numeric"
                maxLength={11}
                ayuda="11 dígitos."
                value={formulario.ruc}
                onChange={(e) =>
                  setFormulario({ ...formulario, ruc: e.target.value.replace(/\D/g, '') })
                }
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="color-acento" className="text-sm font-bold text-ink">
                  Color de acento
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="color-acento"
                    type="color"
                    value={formulario.color_acento}
                    onChange={(e) => setFormulario({ ...formulario, color_acento: e.target.value })}
                    className="h-12 w-16 cursor-pointer rounded-xl border border-line bg-surface p-1"
                  />
                  <span className="cifras font-mono text-sm text-muted">
                    {formulario.color_acento.toUpperCase()}
                  </span>
                  <span
                    className="ml-auto rounded-full px-3 py-1 text-sm font-bold text-white"
                    style={{ background: formulario.color_acento }}
                  >
                    {formulario.nombre_comercial || 'Tu negocio'}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  Lo verán tus clientes en la pantalla de pedidos listos.
                </p>
              </div>
            </fieldset>
            {esDueno && (
              <Boton type="submit" cargando={guardando} className="self-end">
                Guardar cambios
              </Boton>
            )}
          </Tarjeta>
        </form>
      )}
    </>
  );
}
