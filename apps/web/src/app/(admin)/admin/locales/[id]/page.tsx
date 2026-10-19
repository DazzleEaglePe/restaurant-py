'use client';

import type { EditarLocal, Local } from '@resto/contracts';
import { Aviso, Boton, Campo, Casilla, Tarjeta } from '@resto/ui/componentes';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { mensajeDeError } from '@/lib/errores';

import { ZonasDelLocal } from './zonas-local';

type Formulario = {
  nombre: string;
  direccion: string;
  activo: boolean;
  ventana_pagos_min: string;
  permite_constancia: boolean;
  monto_max_constancia: string;
  mesa_obligatoria: boolean;
  cocina_alerta_min: string;
  cocina_critico_min: string;
  ocultar_listos_min: string;
  tiempo_base_min: string;
  costo_taper_defecto: string;
};

const aFormulario = (local: Local): Formulario => ({
  nombre: local.nombre,
  direccion: local.direccion ?? '',
  activo: local.activo,
  ventana_pagos_min: String(local.ventana_pagos_min),
  permite_constancia: local.permite_constancia,
  monto_max_constancia: local.monto_max_constancia ?? '',
  mesa_obligatoria: local.mesa_obligatoria,
  cocina_alerta_min: String(local.cocina_alerta_min),
  cocina_critico_min: String(local.cocina_critico_min),
  ocultar_listos_min: String(local.ocultar_listos_min),
  tiempo_base_min: String(local.tiempo_base_min),
  costo_taper_defecto: local.costo_taper_defecto,
});

/** «12» o «12.5» → «12.50», el formato de montos de la API. */
const monto = (valor: string) => (valor.trim() === '' ? null : Number(valor).toFixed(2));

const aCambios = (f: Formulario): EditarLocal => ({
  nombre: f.nombre.trim(),
  direccion: f.direccion.trim() || null,
  activo: f.activo,
  ventana_pagos_min: Number(f.ventana_pagos_min),
  permite_constancia: f.permite_constancia,
  monto_max_constancia: monto(f.monto_max_constancia),
  mesa_obligatoria: f.mesa_obligatoria,
  cocina_alerta_min: Number(f.cocina_alerta_min),
  cocina_critico_min: Number(f.cocina_critico_min),
  ocultar_listos_min: Number(f.ocultar_listos_min),
  tiempo_base_min: Number(f.tiempo_base_min),
  costo_taper_defecto: monto(f.costo_taper_defecto) ?? '0.00',
});

/** Datos y configuración operativa de un local (RF-TEN-003, docs/06 §3). */
export default function EditarLocalPagina() {
  const { id } = useParams<{ id: string }>();
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.locales.listar().then(
      (locales) => {
        const local = locales.find((l) => l.id === id);
        if (local) setFormulario(aFormulario(local));
        else setError('No encontramos ese local.');
      },
      (problema) => setError(mensajeDeError(problema)),
    );
  }, [id]);

  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setGuardado(false);
    setFormulario((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  };

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!formulario) return;
    setGuardando(true);
    setError(null);
    try {
      setFormulario(aFormulario(await api.locales.editar(id, aCambios(formulario))));
      setGuardado(true);
    } catch (problema) {
      setError(mensajeDeError(problema));
    } finally {
      setGuardando(false);
    }
  }

  const numero = (campo: keyof Formulario, etiqueta: string, ayuda?: string) => (
    <Campo
      etiqueta={etiqueta}
      ayuda={ayuda}
      type="number"
      inputMode="numeric"
      value={formulario?.[campo] as string}
      onChange={(e) => cambiar(campo, e.target.value)}
    />
  );

  return (
    <>
      <Link href="/admin/locales" className="font-bold text-brand">
        ← Locales
      </Link>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {guardado && <Aviso tipo="exito">Cambios guardados.</Aviso>}
      {formulario && (
        <form onSubmit={guardar} className="flex flex-col gap-5">
          <h1 className="font-titulo text-2xl text-ink">{formulario.nombre || 'Local'}</h1>

          <Tarjeta className="flex flex-col gap-4">
            <h2 className="font-bold text-ink">Datos</h2>
            <Campo
              etiqueta="Nombre"
              value={formulario.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
            />
            <Campo
              etiqueta="Dirección"
              value={formulario.direccion}
              onChange={(e) => cambiar('direccion', e.target.value)}
            />
            <Casilla
              checked={formulario.activo}
              onChange={(e) => cambiar('activo', e.target.checked)}
            >
              Local activo
            </Casilla>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4">
            <h2 className="font-bold text-ink">Cobros</h2>
            {numero(
              'ventana_pagos_min',
              'Ventana de pagos (minutos)',
              'Cuánto tiempo atrás se ofrecen los Yape recibidos. Entre 5 y 60.',
            )}
            <Casilla
              checked={formulario.permite_constancia}
              onChange={(e) => cambiar('permite_constancia', e.target.checked)}
            >
              Permitir validar con constancia si se cae el celular de cobros
            </Casilla>
            <Campo
              etiqueta="Monto máximo con constancia (S/, opcional)"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={formulario.monto_max_constancia}
              onChange={(e) => cambiar('monto_max_constancia', e.target.value)}
            />
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4">
            <h2 className="font-bold text-ink">Cocina y pedidos</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {numero('cocina_alerta_min', 'Alerta de demora (min)')}
              {numero('cocina_critico_min', 'Demora crítica (min)')}
              {numero('ocultar_listos_min', 'Ocultar listos tras (min)')}
              {numero('tiempo_base_min', 'Espera sugerida sin historial (min)')}
            </div>
            <Campo
              etiqueta="Costo del táper por defecto (S/)"
              ayuda="Se propone al crear productos; se cobra solo para llevar."
              type="number"
              inputMode="decimal"
              step="0.01"
              value={formulario.costo_taper_defecto}
              onChange={(e) => cambiar('costo_taper_defecto', e.target.value)}
            />
            <Casilla
              checked={formulario.mesa_obligatoria}
              onChange={(e) => cambiar('mesa_obligatoria', e.target.checked)}
            >
              Pedir zona para comer en el local
            </Casilla>
          </Tarjeta>

          <Boton type="submit" cargando={guardando} className="self-end">
            Guardar cambios
          </Boton>
        </form>
      )}
      {formulario && <ZonasDelLocal localId={id} />}
    </>
  );
}
