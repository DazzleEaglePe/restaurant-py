# 06 — Contrato de API

---

## 1. Convenciones generales

### 1.1. Superficies de la API

| Prefijo                                    | Audiencia                         | Autenticación                       |
| ------------------------------------------ | --------------------------------- | ----------------------------------- |
| `/v1/*`                                    | Caja y administración             | `Authorization: Bearer <access JWT>` |
| `/v1/pantallas/sesion/*`, `/v1/cocina/*`, `/v1/publica/*` | Pantallas vinculadas | `Authorization: Bearer <token de pantalla>` |
| `/integraciones/yallego/webhooks/{token}`  | Yallegó                           | Firma HMAC de Yallegó               |
| `/platform/v1/*`                           | Consola interna                   | JWT de plataforma con 2FA           |

**URL base:** `https://api.<dominio>` (dominio por definir). En local,
`http://localhost:4001`.

### 1.2. Cabeceras estándar

| Cabecera          | Dirección  | Uso                                                                       |
| ----------------- | ---------- | ------------------------------------------------------------------------- |
| `Authorization`   | Solicitud  | Token según la superficie                                                 |
| `Idempotency-Key` | Solicitud  | UUID; obligatorio en `POST /v1/pedidos` y `POST /v1/pedidos/{id}/pagos`   |
| `X-Local-Id`      | Solicitud  | Local activo de la caja; obligatorio en rutas de operación                |
| `X-Request-Id`    | Respuesta  | Identificador de la solicitud, presente siempre                           |

### 1.3. Formato de error

```json
{
  "error": {
    "code": "PAGO_YA_USADO",
    "message": "Este pago ya fue usado en otro pedido.",
    "details": { "pedido_numero": 41 },
    "request_id": "b7f3a2e1-…"
  }
}
```

### 1.4. Catálogo de códigos de error

| HTTP | Código                       | Cuándo                                                                     |
| ---- | ---------------------------- | -------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`           | Cuerpo o parámetros inválidos                                              |
| 401  | `UNAUTHENTICATED`            | Sin token, token vencido o revocado                                        |
| 403  | `FORBIDDEN`                  | El rol o la pantalla no permite la acción                                  |
| 403  | `LOCAL_NO_ASIGNADO`          | El cajero no opera en ese local                                            |
| 404  | `NOT_FOUND`                  | No existe o es de otro negocio                                             |
| 409  | `ESTADO_CAMBIADO`            | El pedido cambió de estado mientras tanto                                  |
| 409  | `PAGO_YA_USADO`              | El cobro ya está ligado a otro pago activo, aquí o en Yallegó              |
| 409  | `PAGO_NO_DISPONIBLE`         | El cobro no existe en Yallegó o fue anulado                                |
| 409  | `SOLICITUD_EN_CURSO`         | Llegó la misma `Idempotency-Key` mientras la primera se procesa            |
| 409  | `TURNO_REQUERIDO`            | La cajera no tiene turno abierto en el local                               |
| 409  | `TURNO_CON_PENDIENTES`       | No se puede cerrar: hay pedidos por pagar o pagos confirmándose            |
| 409  | `PRODUCTO_AGOTADO`           | Un ítem está agotado o deshabilitado en el local                           |
| 422  | `CONSTANCIA_NO_PERMITIDA`    | Validación con constancia con el celular de cobros activo o deshabilitada  |
| 422  | `MONTO_SUPERA_MAXIMO`        | Constancia por encima del máximo del local                                 |
| 422  | `IDEMPOTENCY_KEY_REUSED`     | Misma clave con otro cuerpo                                                |
| 422  | `YALLEGO_NO_CONECTADO`       | El negocio no tiene Yallegó conectado o el local no tiene celular          |
| 429  | `RATE_LIMIT_EXCEEDED`        | Demasiadas solicitudes; ver `Retry-After`                                  |
| 502  | `PROVEEDOR_SIN_PERMISO`      | Yallegó rechazó la clave (`401` o `403`)                                   |
| 503  | `PROVEEDOR_NO_DISPONIBLE`    | Yallegó no responde y la operación no se puede encolar                     |

### 1.5. Paginación por cursor

`?limit=50&cursor=…` → `{ "data": [...], "pagination": { "has_more": true, "next_cursor": "…", "limit": 50 } }`.
Mismo esquema que Yallegó.

### 1.6. Formatos

| Tipo          | Formato                                                          |
| ------------- | ---------------------------------------------------------------- |
| Montos        | Cadena con dos decimales: `"25.00"`                              |
| Fechas y horas | ISO 8601 en UTC: `"2026-10-11T18:32:07.412Z"`                   |
| Fecha de operación | `"2026-10-11"`, en la zona horaria del local                |
| Campos        | `snake_case`                                                     |
| Número de pedido | Entero; la interfaz lo muestra como `#0042`                   |

---

## 2. Autenticación

| Método | Ruta                          | Descripción                                              |
| ------ | ----------------------------- | -------------------------------------------------------- |
| `POST` | `/v1/auth/login`              | Ingreso con correo y contraseña                          |
| `POST` | `/v1/auth/refresh`            | Renueva el access token (refresh en cookie `HttpOnly`)   |
| `POST` | `/v1/auth/logout`             | Cierra la sesión                                         |
| `POST` | `/v1/auth/password/forgot`    | Envía enlace de recuperación                             |
| `POST` | `/v1/auth/password/reset`     | Define nueva contraseña con el token                     |
| `POST` | `/v1/auth/invitations/accept` | Activa la cuenta invitada                                |
| `POST` | `/v1/auth/switch-tenant`      | Cambia de negocio activo                                 |
| `GET`  | `/v1/me`                      | Usuario, negocio activo, rol y locales asignados         |

### `POST /v1/auth/login`

```json
// Solicitud
{ "email": "caja1@demo.test", "password": "…" }

// 200
{
  "access_token": "eyJ…",
  "expires_in": 900,
  "user": { "id": "…", "nombre": "Rosa", "email": "caja1@demo.test" },
  "tenant": { "id": "…", "nombre_comercial": "Cevichería Demo" },
  "rol": "CAJERO",
  "locales": [{ "id": "…", "nombre": "Centro" }]
}
```

El refresh token viaja en una cookie `HttpOnly; Secure; SameSite=Strict`.

---

## 3. Negocio y locales

| Método  | Ruta                  | Rol mínimo | Descripción                               |
| ------- | --------------------- | ---------- | ----------------------------------------- |
| `GET`   | `/v1/negocio`         | ADMIN      | Datos del negocio                         |
| `PATCH` | `/v1/negocio`         | OWNER      | Edita nombre, RUC, logo y color de acento |
| `GET`   | `/v1/locales`         | CAJERO     | Locales visibles para el usuario          |
| `POST`  | `/v1/locales`         | ADMIN      | Crea un local                             |
| `PATCH` | `/v1/locales/{id}`    | ADMIN      | Edita datos y configuración               |

### `PATCH /v1/locales/{id}`

```json
{
  "ventana_pagos_min": 15,
  "permite_constancia": true,
  "monto_max_constancia": "150.00",
  "mesa_obligatoria": false,
  "cocina_alerta_min": 10,
  "cocina_critico_min": 20,
  "ocultar_listos_min": 10
}
```

---

## 4. Usuarios

| Método   | Ruta                         | Rol mínimo | Descripción                                    |
| -------- | ---------------------------- | ---------- | ---------------------------------------------- |
| `GET`    | `/v1/usuarios`               | ADMIN      | Lista miembros del negocio                     |
| `POST`   | `/v1/usuarios/invitaciones`  | ADMIN      | Invita con rol y locales                       |
| `PATCH`  | `/v1/usuarios/{id}`          | ADMIN      | Cambia rol, locales o desactiva                |

```json
// POST /v1/usuarios/invitaciones
{ "email": "rosa@correo.pe", "nombre": "Rosa", "rol": "CAJERO", "local_ids": ["…"] }
```

Solo un OWNER puede invitar o modificar a otro OWNER (`403 FORBIDDEN`).

---

## 5. Pantallas vinculadas

| Método   | Ruta                                   | Autenticación       | Descripción                                   |
| -------- | -------------------------------------- | ------------------- | --------------------------------------------- |
| `GET`    | `/v1/pantallas`                        | ADMIN               | Lista pantallas por local                     |
| `POST`   | `/v1/pantallas`                        | ADMIN               | Crea una pantalla y su código de vinculación  |
| `POST`   | `/v1/pantallas/{id}/codigo`            | ADMIN               | Genera un código nuevo                        |
| `DELETE` | `/v1/pantallas/{id}`                   | ADMIN               | Revoca la pantalla                            |
| `POST`   | `/v1/pantallas/vincular`               | Ninguna             | Canjea el código por un token                 |
| `GET`    | `/v1/pantallas/sesion`                 | Token de pantalla   | Datos de la pantalla, local y marca           |

### `POST /v1/pantallas`

```json
// Solicitud. tipo: COCINA (celular que marca), COCINA_MONITOR (solo lectura) o PUBLICA
{ "local_id": "…", "tipo": "COCINA", "nombre": "Celular de cocina" }

// 201
{
  "id": "…",
  "codigo": "K7M2-9XQP",
  "qr": "https://app.<dominio>/vincular?codigo=K7M2-9XQP",
  "expira_at": "2026-10-11T18:42:00Z"
}
```

### `POST /v1/pantallas/vincular`

```json
// Solicitud
{ "codigo": "K7M2-9XQP" }

// 200
{
  "token": "pt_3f6a8c2e…",
  "pantalla": { "id": "…", "tipo": "COCINA", "nombre": "Cocina principal" },
  "local": { "id": "…", "nombre": "Centro" },
  "negocio": { "nombre_comercial": "Cevichería Demo", "logo_url": "…", "color_acento": "#E4572E" }
}
```

El token se muestra una sola vez; límite de 5 intentos por IP cada 10 minutos.

---

## 6. Carta

| Método   | Ruta                                       | Rol mínimo | Descripción                                    |
| -------- | ------------------------------------------ | ---------- | ---------------------------------------------- |
| `GET`    | `/v1/carta?local_id=`                      | CAJERO     | Carta del local: categorías, productos, combos y disponibilidad |
| `GET`    | `/v1/categorias`                           | ADMIN      | Lista categorías                               |
| `POST`   | `/v1/categorias`                           | ADMIN      | Crea                                           |
| `PATCH`  | `/v1/categorias/{id}`                      | ADMIN      | Edita, ordena o desactiva                      |
| `GET`    | `/v1/productos`                            | ADMIN      | Lista productos                                |
| `POST`   | `/v1/productos`                            | ADMIN      | Crea producto o combo con sus platos           |
| `PATCH`  | `/v1/productos/{id}`                       | ADMIN      | Edita                                          |
| `PUT`    | `/v1/productos/{id}/locales/{local_id}`    | ADMIN      | Habilita y fija precio en un local             |
| `POST`   | `/v1/productos/{id}/agotado`               | CAJERO     | Marca agotado en el local de `X-Local-Id`      |
| `DELETE` | `/v1/productos/{id}/agotado`               | CAJERO     | Lo vuelve a habilitar                          |
| `GET`    | `/v1/descuentos?vigentes=true`             | CAJERO     | Descuentos que se pueden aplicar ahora en el local |
| `GET`    | `/v1/descuentos`                           | ADMIN      | Lista descuentos y promociones                 |
| `POST`   | `/v1/descuentos`                           | ADMIN      | Crea                                           |
| `PATCH`  | `/v1/descuentos/{id}`                      | ADMIN      | Edita o desactiva                              |

### `GET /v1/carta?local_id=…`

```json
{
  "version": "2026-10-11T15:02:11Z",
  "categorias": [
    {
      "id": "…",
      "nombre": "Combinados",
      "productos": [
        {
          "id": "…",
          "nombre": "Mixto",
          "precio": "32.00",
          "foto_url": "…",
          "agotado": false,
          "es_combo": true,
          "requiere_cocina": true,
          "componentes": [
            { "nombre": "Ceviche de pescado", "cantidad": 1 },
            { "nombre": "Chicharrón de pota", "cantidad": 1 }
          ]
        }
      ]
    }
  ]
}
```

La caja guarda la carta en caché y la invalida con el evento `carta.actualizada`.

---

## 7. Zonas y mesas

| Método  | Ruta                    | Rol mínimo | Descripción                       |
| ------- | ----------------------- | ---------- | --------------------------------- |
| `GET`   | `/v1/mesas?local_id=`   | CAJERO     | Zonas con sus mesas               |
| `POST`  | `/v1/zonas`             | ADMIN      | Crea zona                         |
| `PATCH` | `/v1/zonas/{id}`        | ADMIN      | Edita o desactiva                 |
| `POST`  | `/v1/mesas`             | ADMIN      | Crea mesa                         |
| `PATCH` | `/v1/mesas/{id}`        | ADMIN      | Edita o desactiva                 |

---

## 8. Turnos de caja

| Método | Ruta                              | Rol mínimo | Descripción                                      |
| ------ | --------------------------------- | ---------- | ------------------------------------------------ |
| `GET`  | `/v1/turnos/actual`               | CAJERO     | Turno abierto del usuario, con totales           |
| `POST` | `/v1/turnos`                      | CAJERO     | Abre turno en el local de `X-Local-Id`           |
| `POST` | `/v1/turnos/{id}/movimientos`     | CAJERO     | Registra ingreso o egreso                        |
| `POST` | `/v1/turnos/{id}/cerrar`          | CAJERO     | Cierra con efectivo contado                      |
| `GET`  | `/v1/turnos?local_id=&desde=&hasta=` | ADMIN   | Historial de turnos                              |
| `POST` | `/v1/turnos/{id}/validar`          | ADMIN      | Valida u observa un turno cerrado, con comentario |
| `GET`  | `/v1/cierres?local_id=&fecha=`     | ADMIN      | Cierre del día: turnos, diferencias, constancias, cancelaciones e incidencias |

### `POST /v1/turnos/{id}/cerrar`

```json
// Solicitud
{ "efectivo_contado": "742.50", "nota": "" }

// 200
{
  "id": "…",
  "estado": "CERRADO",
  "fondo_inicial": "100.00",
  "efectivo_cobrado": "655.00",
  "ingresos": "0.00",
  "egresos": "12.00",
  "efectivo_esperado": "743.00",
  "efectivo_contado": "742.50",
  "diferencia": "-0.50",
  "totales": {
    "efectivo": "655.00",
    "billetera_verificada": "1284.00",
    "billetera_constancia": "48.00",
    "pedidos": 97
  }
}
```

---

## 9. Pedidos

| Método  | Ruta                              | Rol mínimo | Descripción                                          |
| ------- | --------------------------------- | ---------- | ---------------------------------------------------- |
| `POST`  | `/v1/pedidos`                     | CAJERO     | Crea un pedido `POR_PAGAR` (idempotente)             |
| `GET`   | `/v1/pedidos?estado=&fecha=&numero=`      | CAJERO     | Pedidos del local                                    |
| `GET`   | `/v1/pedidos/{id}`                | CAJERO     | Detalle con ítems y pagos                            |
| `PATCH` | `/v1/pedidos/{id}`                | CAJERO     | Edita un pedido `POR_PAGAR`                          |
| `POST`  | `/v1/pedidos/{id}/cancelar`       | CAJERO *   | Cancela                                              |
| `POST`  | `/v1/pedidos/{id}/entregar`       | CAJERO o MESERO | `LISTO` → `ENTREGADO`; el MESERO solo en pedidos para comer en el local |
| `GET`   | `/v1/salon/pedidos`               | MESERO     | Pedidos para comer en el local en cocina y listos, sin montos |
| `POST`  | `/v1/pedidos/{id}/observaciones`  | CAJERO o MESERO | Agrega una observación (reclamo)                |
| `GET`   | `/v1/observaciones?estado=abierta` | CAJERO    | Observaciones por resolver del local                 |
| `POST`  | `/v1/observaciones/{id}/resolver` | CAJERO     | Corrige, cancela o cierra sin cambios                |

\* Un CAJERO cancela directamente solo pedidos `POR_PAGAR`. Un pedido pagado se cancela al resolver una observación (`POST /v1/observaciones/{id}/resolver`).

### `POST /v1/pedidos`

```json
// Cabeceras: Idempotency-Key: 6f1c…  ·  X-Local-Id: …
{
  "tipo": "AQUI",
  "zona_id": "…",
  "nombre_cliente": "Carlos",
  "items": [
    { "producto_id": "…", "cantidad": 2 },
    { "producto_id": "…", "cantidad": 1, "nota": "sin ají" },
    { "producto_id": "…", "cantidad": 2 }
  ],
  "descuento_ids": [],
  "total_esperado": "97.00"
}

// 201
{
  "id": "…",
  "numero": 42,
  "fecha_operacion": "2026-10-11",
  "estado": "POR_PAGAR",
  "tipo": "AQUI",
  "zona": { "id": "…", "nombre": "Terraza" },
  "nombre_cliente": "Carlos",
  "total": "97.00",
  "pagado": "0.00",
  "saldo": "97.00",
  "tiempo_estimado_min": 30,
  "taperes": 0,
  "cargo_taper": "0.00",
  "descuento_total": "0.00",
  "items": [
    { "id": "…", "nombre": "Mixto", "cantidad": 2, "precio_unitario": "32.00", "subtotal": "64.00", "componentes": ["Ceviche de pescado", "Chicharrón de pota"], "nota": null },
    { "id": "…", "nombre": "Ceviche de pescado", "cantidad": 1, "precio_unitario": "25.00", "subtotal": "25.00", "componentes": [], "nota": "sin ají" },
    { "id": "…", "nombre": "Coca-Cola personal", "cantidad": 2, "precio_unitario": "4.00", "subtotal": "8.00", "componentes": [], "nota": null }
  ],
  "pagos": [],
  "version": 1,
  "created_at": "2026-10-11T18:31:40Z"
}
```

`total_esperado` es el total que vio la cajera. Si el servidor calcula otro (cambió
un precio), responde `409 ESTADO_CAMBIADO` con la carta nueva para que la caja lo
muestre antes de cobrar.

`tiempo_estimado_min` es la sugerencia del sistema (`04_ARQUITECTURA_SOFTWARE.md`
§5.10). La cajera puede cambiarlo con `PATCH /v1/pedidos/{id}` antes de cobrar; es
el que se le dice al cliente.

En un pedido para llevar, el sistema suma solo los táperes según el `costo_taper`
de cada producto. Con S/ 1.00 por plato, este mismo pedido llevaría 3 táperes (2
mixtos y 1 ceviche; las bebidas no) y su total sería S/ 100.00. La cajera puede
ajustar la cantidad enviando `taperes` en el `PATCH`.

Los descuentos automáticos vigentes se aplican solos; `descuento_ids` agrega los que
elige la cajera entre los descuentos «a elección» que configuró el administrador.
Las cortesías son descuentos del 100 % configurados. La cajera no puede crear ni
cambiar montos (D25).

### `POST /v1/pedidos/{id}/cancelar`

```json
{ "motivo": "El cliente se fue", "devolucion": "BILLETERA" }
```

`devolucion` es obligatoria si el pedido tiene pagos confirmados.

### `POST /v1/observaciones/{id}/resolver`

```json
// Corregir: la cajera registró jalea (S/ 38.00) y el cliente pidió ceviche (S/ 25.00)
{
  "resolucion": "CORREGIR",
  "reemplaza_item_ids": ["…"],
  "items": [{ "producto_id": "…", "cantidad": 1 }],
  "devolucion": "EFECTIVO",
  "comentario": "Se registró jalea en lugar de ceviche"
}

// 200
{
  "observacion": { "id": "…", "resolucion": "CORREGIDO" },
  "pedido_correccion": {
    "id": "…",
    "numero": 45,
    "corrige_numero": 40,
    "total": "25.00",
    "credito": "38.00",
    "saldo": "0.00",
    "estado": "PENDIENTE"
  },
  "diferencia": "-13.00",
  "devolucion": { "metodo": "EFECTIVO", "monto": "13.00" }
}
```

- Si la diferencia es positiva, la corrección queda `POR_PAGAR` por ese monto y se
  cobra con `POST /v1/pedidos/{id}/pagos`; `devolucion` no se envía.
- `{ "resolucion": "CANCELAR", "devolucion": "BILLETERA", "comentario": "…" }` cancela
  el pedido completo.
- `{ "resolucion": "SIN_CAMBIOS", "comentario": "…" }` solo cierra la observación.

---

## 10. Pagos

| Método | Ruta                                       | Rol mínimo | Descripción                                    |
| ------ | ------------------------------------------ | ---------- | ---------------------------------------------- |
| `GET`  | `/v1/pedidos/{id}/candidatos`              | CAJERO     | Cobros disponibles para el pedido              |
| `POST` | `/v1/pedidos/{id}/pagos`                   | CAJERO     | Registra un pago (idempotente)                 |
| `GET`  | `/v1/pagos/constancias?conciliacion=`      | ADMIN      | Pagos con constancia y su conciliación         |
| `POST` | `/v1/pagos/{id}/conciliar`                 | ADMIN      | Liga a mano un pago con constancia a un cobro  |
| `POST` | `/v1/pagos/{id}/descartar-conciliacion`    | OWNER      | Marca revisado sin cobro (con nota)            |

### `GET /v1/pedidos/{id}/candidatos`

```json
{
  "saldo": "97.00",
  "estado_cobros": "ACTIVO",
  "otros_pedidos_mismo_monto": [{ "id": "…", "numero": 41 }],
  "candidatos": [
    {
      "id": "…",
      "billetera": { "codigo": "YAPE", "nombre": "Yape" },
      "monto": "97.00",
      "nombre_pagador": "Victor A. Capitan N.",
      "codigo_seguridad": "315",
      "ocurrido_at": "2026-10-11T18:30:58Z",
      "coincide_monto": true
    }
  ],
  "preseleccionado_id": null
}
```

`preseleccionado_id` solo viene cuando hay un único candidato con monto exacto y
ningún otro pedido espera ese monto (RF-PAG-005).

### `POST /v1/pedidos/{id}/pagos`

Tres variantes según `tipo`:

```json
// Efectivo
{ "tipo": "EFECTIVO", "monto": "97.00", "recibido": "100.00" }

// Billetera verificada por Yallegó
{ "tipo": "BILLETERA", "cobro_id": "…" }

// Constancia (solo con el celular de cobros caído)
{
  "tipo": "CONSTANCIA",
  "billetera": "YAPE",
  "monto": "97.00",
  "hora": "2026-10-11T18:30:00Z",
  "nombre_pagador": "Victor Capitan",
  "operacion": "18273645",
  "codigo_seguridad": "315",
  "observacion": "No hay servicio de notificaciones"
}
```

Respuestas:

| HTTP | Cuándo                                         | Cuerpo                                                         |
| ---- | ---------------------------------------------- | -------------------------------------------------------------- |
| 200  | Pago confirmado                                | `{ "pago": {…}, "pedido": {…} }` con el pedido actualizado     |
| 202  | Yallegó no respondió; se reintenta             | `{ "pago": { "estado": "RESERVADO" }, "pedido": {…} }` y el resultado llega por socket (`pago.confirmado` o `pago.rechazado`) |
| 409  | `PAGO_YA_USADO`, `PAGO_NO_DISPONIBLE`, `ESTADO_CAMBIADO` | Error estándar                                     |
| 422  | `CONSTANCIA_NO_PERMITIDA`, `MONTO_SUPERA_MAXIMO` | Error estándar                                               |
| 502  | `PROVEEDOR_SIN_PERMISO`                        | Error estándar                                                 |

---

## 11. Estado de cobros

| Método | Ruta                                  | Rol mínimo | Descripción                                    |
| ------ | ------------------------------------- | ---------- | ---------------------------------------------- |
| `GET`  | `/v1/cobros/estado?local_id=`         | CAJERO     | Estado de cobros del local y sus celulares     |
| `GET`  | `/v1/cobros/incidencias?local_id=`    | ADMIN      | Historial de incidencias                       |

```json
// GET /v1/cobros/estado?local_id=…
{
  "estado": "DESCONECTADO",
  "desde": "2026-10-11T18:02:00Z",
  "constancia_habilitada": true,
  "celulares": [
    {
      "etiqueta": "Yape Centro",
      "conectividad": "OFFLINE",
      "ultimo_reporte_at": "2026-10-11T17:59:41Z"
    }
  ],
  "causas_probables": ["SIN_INTERNET", "APAGADO", "APP_CERRADA", "SIN_PERMISO_NOTIFICACIONES", "AHORRO_BATERIA"]
}
```

---

## 12. Cocina (pantalla vinculada)

| Método | Ruta                                   | Descripción                                        |
| ------ | -------------------------------------- | -------------------------------------------------- |
| `GET`  | `/v1/cocina/pedidos`                   | Pedidos `PENDIENTE` y `EN_PREPARACION`, y los de mesa en `LISTO` |
| `POST` | `/v1/cocina/pedidos/{id}/preparar`     | `PENDIENTE` → `EN_PREPARACION`                     |
| `POST` | `/v1/cocina/pedidos/{id}/listo`        | `EN_PREPARACION` → `LISTO`                         |
| `POST` | `/v1/cocina/pedidos/{id}/deshacer`     | Revierte el último cambio si ocurrió hace ≤ 10 s   |
| `POST` | `/v1/cocina/pedidos/{id}/entregado`    | Pedido para mesa: `LISTO` → `ENTREGADO` cuando la mesera recoge los platos |

Proyección de cocina (sin montos ni datos del pagador):

```json
{
  "id": "…",
  "numero": 42,
  "tipo": "AQUI",
  "zona": "Patio de comida",
  "corrige_numero": null,
  "nombre_cliente": "Carlos",
  "estado": "PENDIENTE",
  "pagado_at": "2026-10-11T18:31:59Z",
  "items": [
    { "nombre": "Mixto", "cantidad": 2, "componentes": ["Ceviche de pescado", "Chicharrón de pota"], "nota": null },
    { "nombre": "Ceviche de pescado", "cantidad": 1, "componentes": [], "nota": "sin ají" }
  ],
  "version": 3
}
```

Las acciones aceptan `{ "version": 3 }`; si no coincide, `409 ESTADO_CAMBIADO`.

---

## 13. Pantalla pública (pantalla vinculada)

| Método | Ruta                    | Descripción                                      |
| ------ | ----------------------- | ------------------------------------------------ |
| `GET`  | `/v1/publica/pedidos`   | Pedidos en preparación y listos del local        |

```json
{
  "en_preparacion": [{ "numero": 43, "nombre": "María G.", "version": 2 }],
  "listos": [{ "numero": 42, "nombre": "Carlos", "listo_at": "2026-10-11T18:44:10Z", "version": 4 }]
}
```

---

## 14. Integración con Yallegó

| Método   | Ruta                                          | Rol mínimo | Descripción                                          |
| -------- | --------------------------------------------- | ---------- | ---------------------------------------------------- |
| `GET`    | `/v1/integraciones/yallego`                   | ADMIN      | Estado de la conexión                                |
| `POST`   | `/v1/integraciones/yallego`                   | OWNER      | Conecta con una clave de API                         |
| `PUT`    | `/v1/integraciones/yallego/clave`             | OWNER      | Reemplaza la clave                                   |
| `POST`   | `/v1/integraciones/yallego/prueba`            | OWNER      | Pide a Yallegó un evento de prueba                   |
| `DELETE` | `/v1/integraciones/yallego`                   | OWNER      | Desconecta                                           |
| `GET`    | `/v1/integraciones/yallego/celulares`         | ADMIN      | Celulares de Yallegó y su local asignado             |
| `PATCH`  | `/v1/integraciones/yallego/celulares/{id}`    | OWNER      | Asigna o quita el local                              |

### `POST /v1/integraciones/yallego`

```json
// Solicitud
{ "api_key": "yk_live_9f8c2a1e4b7d3f6a8c2e1b5d7f9a3c6e" }

// 201
{
  "estado": "CONECTADA",
  "api_key_prefijo": "yk_live_9f8c2a1e",
  "verificaciones": {
    "transactions_read": true,
    "devices_read": true,
    "webhooks_write": true,
    "transactions_write": "SE_COMPRUEBA_AL_PRIMER_COBRO"
  },
  "webhook": { "id": "…", "eventos": ["transaction.created", "transaction.confirmed", "transaction.disputed", "device.offline", "device.online"] },
  "celulares": [{ "id": "…", "etiqueta": "Celular caja principal", "local_id": null }]
}
```

Al conectar, el backend:

1. Llama `GET /v1/devices` y `GET /v1/transactions?limit=1` con la clave.
2. Registra `POST /v1/webhooks` con la URL
   `https://api.<dominio>/integraciones/yallego/webhooks/{webhook_token}`.
3. Guarda clave y secreto cifrados.
4. Si un paso falla, deshace los anteriores y responde el error de Yallegó traducido.

---

## 15. Recepción de webhooks de Yallegó

`POST /integraciones/yallego/webhooks/{token}`

| Paso | Regla                                                                                         | Si falla          |
| ---- | --------------------------------------------------------------------------------------------- | ----------------- |
| 1    | El token existe y la conexión no está desconectada                                            | `410 Gone`        |
| 2    | `X-Yallego-Timestamp` a 5 minutos o menos del reloj del servidor                              | `401`             |
| 3    | `X-Yallego-Signature` (o `-Previous` en rotación) válida sobre el cuerpo crudo, comparada en tiempo constante | `401` |
| 4    | `X-Yallego-Event-Id` no procesado antes                                                       | `200` sin efecto  |
| 5    | Guarda en `yallego_eventos` y encola                                                          | `500` (Yallegó reintenta) |

Responde `200` con cuerpo vacío. Responder `410` hace que Yallegó deshabilite el
endpoint (ver su guía de reintentos); solo se usa con conexiones eliminadas.

---

## 16. Reportes

| Método | Ruta                                                     | Rol mínimo | Descripción                           |
| ------ | -------------------------------------------------------- | ---------- | ------------------------------------- |
| `GET`  | `/v1/reportes/ventas?desde=&hasta=&local_id=`            | ADMIN      | Ventas por día y método               |
| `GET`  | `/v1/reportes/productos?desde=&hasta=&local_id=`         | ADMIN      | Ventas por producto y categoría       |
| `GET`  | `/v1/reportes/cocina?desde=&hasta=&local_id=`            | ADMIN      | Tiempos de cocina                     |
| `POST` | `/v1/reportes/{tipo}/export`                             | ADMIN      | CSV con los mismos filtros            |

---

## 17. Auditoría

| Método | Ruta                                                    | Rol mínimo | Descripción          |
| ------ | ------------------------------------------------------- | ---------- | -------------------- |
| `GET`  | `/v1/auditoria?desde=&hasta=&accion=&usuario_id=&local_id=` | ADMIN  | Consulta paginada    |

---

## 18. WebSocket

**Endpoint:** `wss://api.<dominio>/v1/tiempo-real` (Socket.io)

### 18.1. Handshake

```javascript
const socket = io('wss://api.<dominio>/v1/tiempo-real', {
  transports: ['websocket'],
  auth: { token: accessToken },     // o el token de pantalla
  query: { local_id: '…' },         // caja: local activo
});
```

El servidor une la conexión a sus salas según el token (ver
`04_ARQUITECTURA_SOFTWARE.md` §5.7). Un cajero solo entra a locales asignados.

### 18.2. Eventos del servidor

| Evento                 | Salas                | Carga                                                       |
| ---------------------- | -------------------- | ----------------------------------------------------------- |
| `pedido.actualizado`   | caja                 | Pedido completo (como `GET /v1/pedidos/{id}`)               |
| `cobro.recibido`       | caja                 | Candidato (como en `/candidatos`)                           |
| `cobro.no_disponible`  | caja                 | `{ cobro_id }`                                              |
| `pago.confirmado`      | caja                 | `{ pago, pedido }`                                          |
| `pago.rechazado`       | caja                 | `{ pago_id, pedido_id, code, message }`                     |
| `cobros.estado`        | caja, admin          | Como `GET /v1/cobros/estado`                                |
| `carta.actualizada`    | caja                 | `{ version }`                                               |
| `cocina.pedido`        | cocina               | Proyección de cocina; `estado: "CANCELADO"` para retirarlo  |
| `salon.pedido`         | salón                | Proyección de salón (como cocina, con mesa); `estado: "ENTREGADO"` para retirarlo |
| `observacion.creada`   | caja                 | Pedido, tipo y comentario                                   |
| `observacion.resuelta` | caja, salón          | Resolución y pedido de corrección                           |
| `publica.pedido`       | pública              | Proyección pública; `estado: "ENTREGADO"` para retirarlo    |
| `turno.cerrado`        | admin                | Resumen del turno                                           |
| `yallego.conexion`     | admin                | `{ estado, ultimo_error }`                                  |

### 18.3. Comportamiento

| Aspecto     | Definición                                                                  |
| ----------- | --------------------------------------------------------------------------- |
| Orden       | Cada proyección trae `version`; el cliente descarta versiones viejas         |
| Reconexión  | Espera creciente hasta 10 s; al reconectar, el cliente pide el estado completo |
| Heartbeat   | Ping cada 20 s                                                              |
| Latencia    | < 1 s p95 desde el `COMMIT` (RNF-REN-003)                                   |

---

## 19. Plataforma

| Método  | Ruta                                       | Descripción                                  |
| ------- | ------------------------------------------ | -------------------------------------------- |
| `POST`  | `/platform/v1/auth/login`                  | Ingreso con contraseña y TOTP                |
| `GET`   | `/platform/v1/negocios`                    | Lista con estado de Yallegó y de cobros      |
| `POST`  | `/platform/v1/negocios`                    | Alta asistida e invitación al OWNER          |
| `POST`  | `/platform/v1/negocios/{id}/suspender`     | Suspende                                     |
| `POST`  | `/platform/v1/negocios/{id}/reactivar`     | Reactiva                                     |
| `POST`  | `/platform/v1/negocios/{id}/suscripciones` | Registra un período pagado                   |

---

## 20. Llamadas salientes a Yallegó

| Momento                         | Llamada a Yallegó                                       | Alcance              |
| ------------------------------- | ------------------------------------------------------- | -------------------- |
| Conectar                        | `GET /v1/devices`, `GET /v1/transactions?limit=1`, `POST /v1/webhooks` | `devices:read`, `transactions:read`, `webhooks:write` |
| Probar conexión                 | `POST /v1/webhooks/{id}/test`                           | `webhooks:write`     |
| Consulta de respaldo (cada 10 s) | `GET /v1/transactions?status=CAPTURED&from=…`          | `transactions:read`  |
| Estado de celulares (cada 30 s) | `GET /v1/devices`                                       | `devices:read`       |
| Confirmar un pago               | `POST /v1/transactions/{id}/confirm`                    | `transactions:write` |
| Resolver un `409`               | `GET /v1/transactions/{id}`                             | `transactions:read`  |
| Conciliar una constancia        | `POST /v1/transactions/{id}/confirm`                    | `transactions:write` |
| Rotar secreto                   | `POST /v1/webhooks/{id}/rotate-secret`                  | `webhooks:write`     |
| Desconectar                     | `DELETE /v1/webhooks/{id}`                              | `webhooks:write`     |

Alcances que el OWNER debe dar a la clave: `transactions:read`,
`transactions:write`, `devices:read`, `webhooks:read`, `webhooks:write`.

Todas las llamadas usan un timeout de 5 s, registran la cabecera
`X-RateLimit-Remaining` y respetan `Retry-After` ante un `429`.
