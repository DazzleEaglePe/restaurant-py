import type { Correo } from '../../infrastructure/correo/correo.service';

/** Escapa el texto que viene del usuario antes de ponerlo en el HTML. */
const html = (texto: string) =>
  texto.replace(
    /[&<>"']/g,
    (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' }[c]};`,
  );

function correo(
  para: string,
  asunto: string,
  parrafos: string[],
  boton?: { texto: string; enlace: string },
): Correo {
  const texto = [...parrafos, ...(boton ? [`${boton.texto}: ${boton.enlace}`] : [])].join('\n\n');
  const cuerpo = parrafos.map((p) => `<p style="margin:0 0 16px">${html(p)}</p>`).join('');
  const accion = boton
    ? `<p style="margin:24px 0"><a href="${html(boton.enlace)}" style="background:#0E4C7A;color:#FFFFFF;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">${html(boton.texto)}</a></p>`
    : '';
  return {
    para,
    asunto,
    texto,
    html: `<div style="font-family:'Nunito Sans',Arial,sans-serif;color:#0B2540;max-width:480px">${cuerpo}${accion}</div>`,
  };
}

/** Invitación de 72 h (docs/07_SEGURIDAD_AUTH.md §2.3). */
export function correoInvitacion(datos: {
  para: string;
  nombre: string;
  negocio: string;
  enlace: string;
}): Correo {
  return correo(
    datos.para,
    `Te invitaron a ${datos.negocio}`,
    [
      `Hola, ${datos.nombre}.`,
      `${datos.negocio} te invitó a su equipo. Crea tu contraseña para empezar.`,
      'El enlace vence en 72 horas y sirve una sola vez.',
    ],
    { texto: 'Activar mi cuenta', enlace: datos.enlace },
  );
}

/** Cuenta que ya existía y ahora también pertenece a otro negocio. */
export function correoAgregado(datos: {
  para: string;
  nombre: string;
  negocio: string;
  enlace: string;
}): Correo {
  return correo(
    datos.para,
    `Ahora eres parte de ${datos.negocio}`,
    [
      `Hola, ${datos.nombre}.`,
      `${datos.negocio} te agregó a su equipo. Entra con tu correo y tu contraseña de siempre.`,
    ],
    { texto: 'Ingresar', enlace: datos.enlace },
  );
}

/** Recuperación de 60 min (RF-AUTH-004). */
export function correoRecuperacion(datos: {
  para: string;
  nombre: string;
  enlace: string;
}): Correo {
  return correo(
    datos.para,
    'Crea una contraseña nueva',
    [
      `Hola, ${datos.nombre}.`,
      'Recibimos un pedido para cambiar tu contraseña. Si no fuiste tú, ignora este correo.',
      'El enlace vence en 60 minutos y sirve una sola vez.',
    ],
    { texto: 'Crear contraseña nueva', enlace: datos.enlace },
  );
}
