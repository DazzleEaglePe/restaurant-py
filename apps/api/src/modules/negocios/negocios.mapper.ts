import type { Negocio as NegocioDb, Local as LocalDb, Prisma } from '@prisma/client';
import type { Local, Negocio } from '@resto/contracts';

const monto = (valor: Prisma.Decimal) => valor.toFixed(2);

export function aNegocio(negocio: NegocioDb): Negocio {
  return {
    id: negocio.id,
    nombre_comercial: negocio.nombreComercial,
    razon_social: negocio.razonSocial,
    ruc: negocio.ruc,
    zona_horaria: negocio.zonaHoraria,
    logo_url: negocio.logoUrl,
    color_acento: negocio.colorAcento,
    estado: negocio.estado,
  };
}

export function aLocal(local: LocalDb): Local {
  return {
    id: local.id,
    nombre: local.nombre,
    direccion: local.direccion,
    activo: local.activo,
    ventana_pagos_min: local.ventanaPagosMin,
    permite_constancia: local.permiteConstancia,
    monto_max_constancia: local.montoMaxConstancia ? monto(local.montoMaxConstancia) : null,
    mesa_obligatoria: local.mesaObligatoria,
    cocina_alerta_min: local.cocinaAlertaMin,
    cocina_critico_min: local.cocinaCriticoMin,
    ocultar_listos_min: local.ocultarListosMin,
    tiempo_base_min: local.tiempoBaseMin,
    costo_taper_defecto: monto(local.costoTaperDefecto),
    estado_cobros: local.estadoCobros,
    estado_cobros_desde: local.estadoCobrosDesde.toISOString(),
  };
}
