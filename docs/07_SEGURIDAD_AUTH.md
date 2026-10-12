# 07 — Seguridad y Autenticación

---

## 1. Estrategia por audiencia

| Audiencia                | Riesgo principal                                         | Mecanismo                                                         |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| Cajeras (celular)        | Celular compartido o perdido; sesión larga               | JWT de 15 min + refresh rotativo en cookie `HttpOnly`             |
| Meseras (celular)        | Igual que cajeras, con menos permisos                    | Igual que cajeras                                                 |
| Administración (escritorio) | XSS, CSRF, robo de sesión                             | Igual que cajeras                                                 |
| Pantallas de cocina y pública | Equipo fijo y sin vigilancia en el local            | Token opaco de pantalla, vinculado a un local y revocable         |
| Yallegó (webhooks)       | Eventos falsificados o repetidos                          | Firma HMAC-SHA256, ventana de 5 min, idempotencia por `event_id`  |
| Consola de plataforma    | Acceso a todos los negocios                               | JWT propio, contraseña + TOTP obligatorio, lista de IPs            |

Mismo enfoque que Yallegó (`~/Desktop/yallego/docs/07_SEGURIDAD_AUTH.md`), adaptado
a las audiencias de un restaurante.

---

## 2. Autenticación de usuarios

### 2.1. Access token

```json
{
  "sub": "usuario-uuid",
  "tid": "negocio-uuid",
  "rol": "CAJERO",
  "loc": ["local-uuid"],
  "iat": 1760205600,
  "exp": 1760206500
}
```

`loc` lista los locales asignados de un CAJERO o MESERO; para OWNER y ADMIN va vacío y
significa «todos». Un cambio de rol o de locales invalida los refresh tokens del
usuario para que el siguiente token refleje el cambio.

### 2.2. Parámetros

| Parámetro                        | Valor                                           |
| -------------------------------- | ----------------------------------------------- |
| Algoritmo                        | `RS256`                                         |
| Vigencia del access token        | 15 minutos                                      |
| Vigencia del refresh token       | 30 días, renovable; mínimo 12 h de sesión en caja (RF-AUTH-007) |
| Rotación del refresh token       | En cada uso, con detección de reutilización     |
| Almacenamiento del refresh token | Cookie `HttpOnly; Secure; SameSite=Strict`      |
| Almacenamiento del access token  | Memoria de la app; nunca `localStorage`         |

### 2.3. Contraseñas

| Regla                                                                   |
| ----------------------------------------------------------------------- |
| Argon2id: 64 MB de memoria, 3 iteraciones, paralelismo 4                |
| Mínimo 10 caracteres; se rechazan las 10 000 más comunes                 |
| Bloqueo de 15 minutos tras 5 intentos fallidos                           |
| Enlaces de invitación (72 h) y recuperación (60 min) de un solo uso, guardados como hash |

### 2.4. Celular de caja perdido

El OWNER o ADMIN desactiva al usuario o cierra sus sesiones desde la
administración. Todos sus refresh tokens se revocan y el access token vigente
expira en menos de 15 minutos.

---

## 3. Pantallas vinculadas

### 3.1. Vinculación

1. Un OWNER o ADMIN crea la pantalla (local + tipo) y obtiene un código de 8
   caracteres sin ambigüedades (`K7M2-9XQP`), válido 10 minutos y de un solo uso.
2. En el equipo se abre `/vincular` y se ingresa el código o se escanea el QR.
3. El servidor emite un token `pt_` de 256 bits aleatorios, guarda solo su SHA-256
   y lo entrega una única vez.
4. El equipo guarda el token y en adelante entra solo, incluso tras un corte de luz.

### 3.2. Privilegio mínimo

| Tipo     | Puede                                                              | No puede                          |
| -------- | ------------------------------------------------------------------ | --------------------------------- |
| COCINA   | Leer la proyección de cocina de su local; pasar a preparación, listo y deshacer; marcar entregado un pedido para mesa | Ver montos, pagos, otros locales |
| PUBLICA  | Leer la proyección pública de su local                             | Cualquier escritura              |

Una pantalla revocada recibe `401` en su próxima solicitud y su socket se
desconecta de inmediato.

---

## 4. Autorización

### 4.1. Modelo

RBAC por negocio (OWNER, ADMIN, CAJERO) más alcance por local para CAJERO. La
matriz completa está en `02_REQUERIMIENTOS_FUNCIONALES.md` §3.1.

### 4.2. Invariantes

1. `tenant_id` sale del token, nunca de la solicitud.
2. Toda ruta de operación exige `X-Local-Id` y verifica que el usuario lo tenga
   asignado (o sea OWNER o ADMIN).
3. Un recurso de otro negocio responde `404`, no `403`, para no revelar que existe.
4. La validación con constancia se habilita **en el servidor** según el estado de
   cobros del local; la interfaz solo refleja esa decisión.
5. Ninguna superficie recibe más datos de los que muestra (proyecciones por
   superficie, ver `04_ARQUITECTURA_SOFTWARE.md` §5.7).

---

## 5. Aislamiento entre negocios

| Capa          | Mecanismo                                                          |
| ------------- | ------------------------------------------------------------------ |
| Aplicación    | Contexto de negocio obligatorio en cada servicio y cada consulta   |
| Base de datos | Row Level Security con negación por omisión (`05_MODELO_DATOS.md` §4) |
| Tiempo real   | Salas por local; el servidor decide a qué salas entra cada conexión |
| Colas         | Cada job lleva `tenant_id` y el worker abre `withTenant`           |
| Pruebas       | Suite que intenta leer y escribir recursos de otro negocio por cada ruta y espera `404` |

---

## 6. Credenciales de Yallegó

### 6.1. Almacenamiento

| Dato                         | Tratamiento                                                                 |
| ---------------------------- | --------------------------------------------------------------------------- |
| Clave de API del negocio     | AES-256-GCM con la clave de cifrado del sistema (`ENCRYPTION_KEY`); se muestra solo el prefijo |
| Secreto del webhook          | AES-256-GCM; se guarda también el anterior durante una rotación (24 h)       |
| Token de la URL del webhook  | 32 bytes aleatorios en base64url; identifica la conexión, no la autentica    |

La clave de cifrado se carga desde el gestor de secretos del servidor, nunca desde
el repositorio. Rotarla requiere recifrar con un job que lee con la clave vieja y
escribe con la nueva.

### 6.2. Uso

- Solo el backend descifra y usa la clave, en memoria y por el tiempo de la llamada.
- La clave nunca aparece en registros, errores, métricas ni respuestas.
- Si Yallegó responde `401` o `403`, la conexión pasa a `ERROR` y se avisa al OWNER.

### 6.3. Recepción de webhooks

| Control                | Regla                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| Firma                  | `HMAC-SHA256(secreto, "{timestamp}.{cuerpo_crudo}")`, comparada en tiempo constante |
| Repetición             | Se rechaza `X-Yallego-Timestamp` con más de 5 minutos de diferencia         |
| Idempotencia           | `X-Yallego-Event-Id` único por conexión en `yallego_eventos`                |
| Cuerpo crudo           | La ruta recibe el cuerpo sin parsear; se verifica antes de deserializar     |
| Tamaño                 | Máximo 64 KB                                                                |
| Límite de solicitudes  | 600 por minuto por token de URL                                             |

---

## 7. Controles contra el fraude

| Riesgo                                                   | Control                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Constancia falsa                                         | Solo con el celular de cobros caído; conciliación automática; «Sin respaldo» avisa al dueño |
| Validar con constancia teniendo el celular activo        | El servidor lo rechaza (`422 CONSTANCIA_NO_PERMITIDA`)                                   |
| Montos altos por constancia                              | Sin tope por decisión del negocio (D11): queda registrada con el estado del celular, se concilia y se revisa al validar el cierre. El tope y el PIN se pueden activar después |
| Usar el Yape de un cliente para otro pedido              | Un cobro, un pago activo (índice único) y registro de quién confirmó                    |
| Cancelar un pedido pagado y quedarse el dinero           | Motivo y forma de devolución obligatorios; auditoría; revisión del administrador al validar el cierre (P14) |
| Diferencias de caja recurrentes                          | Reporte de turnos con diferencia por cajera                                             |

---

## 8. Protección de datos

### 8.1. Clasificación

| Dato                                 | Clasificación   | Tratamiento                                                        |
| ------------------------------------ | --------------- | ------------------------------------------------------------------ |
| Contraseñas                          | Crítico         | Argon2id; nunca recuperable                                        |
| Clave de API y secreto de Yallegó    | Crítico         | AES-256-GCM; nunca sale del backend                                |
| Tokens de pantalla y refresh         | Crítico         | Solo hash SHA-256                                                  |
| Nombre del pagador                   | Personal        | AES-256-GCM; visible en caja y administración; depurado a los 90 días |
| Nombre que da el cliente             | Personal mínimo | Abreviado en la pantalla pública («María G.»)                      |
| Montos, pedidos, turnos              | Confidencial del negocio | RLS; nunca en la pantalla pública ni en cocina            |
| Correo de usuarios                   | Personal        | Solo visible para OWNER y ADMIN del negocio                        |

### 8.2. Cumplimiento

- Ley 29733 y su reglamento: finalidad informada en los términos, retención
  limitada (`05_MODELO_DATOS.md` §7), atención de solicitudes de acceso y supresión.
- El negocio es responsable de los datos de sus clientes; la plataforma es
  encargada del tratamiento. Pendiente de revisión legal.

### 8.3. Cifrado en tránsito

TLS 1.2 o superior en todo el tráfico, HSTS en los dominios públicos, WSS para el
socket. Las llamadas a Yallegó verifican el certificado.

---

## 9. Seguridad de la aplicación web

| Amenaza            | Control                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| XSS                | React escapa por defecto; CSP estricta con `nonce`; sin `dangerouslySetInnerHTML`       |
| CSRF               | Refresh en cookie `SameSite=Strict`; operaciones con cabecera `Authorization`             |
| Clickjacking       | `frame-ancestors 'none'`                                                                  |
| Robo de token en pantalla fija | Token revocable por local; sin acceso a montos ni escritura relevante         |
| Dependencias       | Auditoría de dependencias en la CI; actualizaciones semanales                             |
| Secretos en el repositorio | Gitleaks en la CI y en un hook previo al commit                                  |

---

## 10. Auditoría

Acciones registradas (RF-AUD-001), con actor, local, IP y datos relevantes:

| Acción                            | Datos guardados                                        |
| --------------------------------- | ------------------------------------------------------ |
| `pagos.constancia`                | Pedido, monto, hora declarada, estado de cobros        |
| `pagos.conciliacion_manual`       | Pago, cobro ligado o motivo del descarte               |
| `pedidos.cancelado_pagado`        | Pedido, monto, motivo, devolución                      |
| `turnos.cerrado_con_diferencia`   | Esperado, contado, diferencia                          |
| `carta.precio_cambiado`           | Producto, precio anterior y nuevo                      |
| `yallego.conectado` / `desconectado` / `clave_reemplazada` | Prefijo de la clave              |
| `usuarios.*`, `pantallas.*`       | Usuario o pantalla afectada, cambio                    |

La tabla no tiene `UPDATE` ni `DELETE` permitidos para el rol de la aplicación.

---

## 11. Administración de plataforma

- Usuarios aparte (`administradores_plataforma`), con TOTP obligatorio.
- Acceso solo desde las IPs permitidas de la VPN del equipo.
- Rol de base de datos con `BYPASSRLS` usado exclusivamente en `/platform/v1`.
- Toda acción de plataforma queda en auditoría del negocio afectado con
  `actor_tipo = 'PLATAFORMA'`.
