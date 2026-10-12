# 04 — Arquitectura de Software

---

## 1. Decisión arquitectónica principal

**Monolito modular en NestJS, desplegado como dos procesos (API y worker), que
consume Yallegó como un integrador externo a través de una capa anticorrupción.**

### 1.1. Opciones evaluadas

| Opción                                           | Ventaja                                               | Desventaja                                                       | Decisión          |
| ------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------- | ----------------- |
| Módulo dentro del monorepo de Yallegó            | Reutiliza todo; sin red entre ambos                   | Acopla dos productos; el restaurante no prueba la API pública    | Descartada        |
| Microservicios (pedidos, pagos, cocina)          | Escala por separado                                   | Complejidad operativa desproporcionada para el equipo            | Descartada        |
| **Monolito modular aparte, mismo stack que Yallegó** | Un despliegue; equipo ya conoce el stack; usa Yallegó como cualquier cliente | Hay que mantener dos repositorios                     | ✅ **Seleccionada** |

### 1.2. Justificación

- **El restaurante es el primer cliente real de la API pública de Yallegó.** Cada
  hueco que aparezca aquí es una mejora para todos los integradores (ver brechas
  Y1–Y8 en `01_CONTEXTO_Y_ANALISIS.md` §4.3).
- **El dominio es transaccional y pequeño.** Pedidos, pagos y turnos comparten
  transacciones de base de datos; separarlos en servicios obligaría a sagas
  distribuidas sin necesidad.
- **El tiempo real es interno.** Caja, cocina y pantalla se sincronizan con un
  socket propio; Yallegó solo alimenta los cobros.

### 1.3. Camino de evolución

1. Si un negocio supera la capacidad de una instancia, se escala la API
   horizontalmente (sin estado, Socket.io con adaptador de Redis).
2. Si Yallegó publica cobros esperados (`payment-intents`), el adaptador de
   Yallegó los usa y el emparejamiento local queda como respaldo.
3. Si aparece un segundo proveedor de validación, se agrega otro adaptador del
   puerto `ProveedorBilletera`.

---

## 2. Vista de contexto

```
                ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                │ Caja         │   │ Cocina       │   │ Pantalla     │   │ Administración│
                │ (celular)    │   │ (tablet)     │   │ pública (TV) │   │ (escritorio) │
                └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
                       └──────────────────┴─── HTTPS + WSS ──┴──────────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │      Backend resto        │
                                    │  API · Socket.io · Worker │
                                    └──┬──────────┬──────────┬──┘
                                       │          │          │
                                ┌──────▼───┐ ┌────▼─────┐    │  REST con clave de API
                                │PostgreSQL│ │  Redis   │    ├──────────────────────────┐
                                │ con RLS  │ │colas+pub │    │                          ▼
                                └──────────┘ └──────────┘    │                 ┌─────────────────┐
                                                             │◄── webhooks ────│    Yallegó      │
                                                                  firmados     └────────▲────────┘
                                                                                        │ notificaciones
                                                                               ┌────────┴────────┐
                                                                               │Celular de cobros│
                                                                               │(app Yallegó)    │
                                                                               └─────────────────┘
```

---

## 3. Vista de componentes del backend

| Módulo             | Responsabilidad                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `auth`             | Ingreso, sesiones, recuperación, invitaciones                                              |
| `negocios`         | Tenants, locales y su configuración                                                        |
| `usuarios`         | Membresías, roles y locales asignados                                                      |
| `pantallas`        | Vinculación y tokens de cocina y pantalla pública                                          |
| `carta`            | Categorías, productos, combos fijos y disponibilidad por local                          |
| `mesas`            | Zonas y mesas                                                                              |
| `pedidos`          | Ciclo de vida del pedido, numeración diaria, idempotencia                                  |
| `pagos`            | Efectivo, billetera, constancia, emparejamiento y confirmación                             |
| `caja`             | Turnos, movimientos y cierre                                                               |
| `yallego`          | Conexión, recepción de webhooks, copia local de cobros, consulta de respaldo, adaptador HTTP |
| `cobros`           | Estado del celular de cobros por local, incidencias y avisos                               |
| `conciliacion`     | Conciliación posterior de pagos con constancia                                             |
| `tiempo-real`      | Gateway Socket.io, salas por local y por superficie                                        |
| `reportes`         | Consultas agregadas                                                                        |
| `auditoria`        | Registro inmutable de acciones sensibles                                                   |
| `plataforma`       | Consola interna: alta de negocios, suspensión, planes                                      |

### 3.1. Capa anticorrupción con Yallegó

El dominio no conoce Yallegó. Habla con un puerto:

```typescript
interface ProveedorBilletera {
  listarCobrosRecientes(conexion: Conexion, desde: Date): Promise<CobroExterno[]>;
  confirmarCobro(conexion: Conexion, cobroId: string, nota: string): Promise<ResultadoConfirmacion>;
  obtenerCobro(conexion: Conexion, cobroId: string): Promise<CobroExterno>;
  listarCelulares(conexion: Conexion): Promise<CelularExterno[]>;
  registrarWebhook(conexion: Conexion, url: string): Promise<{ id: string; secreto: string }>;
  eliminarWebhook(conexion: Conexion, webhookId: string): Promise<void>;
  probarWebhook(conexion: Conexion, webhookId: string): Promise<void>;
}

type ResultadoConfirmacion =
  | { tipo: 'CONFIRMADO' }
  | { tipo: 'YA_USADO'; estadoActual: 'CONFIRMED' | 'DISPUTED' | 'VOIDED' }
  | { tipo: 'NO_ENCONTRADO' }
  | { tipo: 'SIN_PERMISO' }          // 401 o 403
  | { tipo: 'NO_DISPONIBLE' };       // timeout, 5xx o 429
```

| Adaptador                 | Uso                                                                               |
| ------------------------- | --------------------------------------------------------------------------------- |
| `YallegoHttpAdapter`      | Producción. Usa `packages/yallego-client`                                          |
| `YallegoMemoriaAdapter`   | Pruebas unitarias, en memoria                                                     |
| Simulador HTTP            | Desarrollo y CI: `tools/yallego-simulador` imita la API y emite webhooks firmados |

Los estados, códigos y nombres de Yallegó se traducen en el adaptador. El resto
del sistema trabaja con `CobroExterno`, `CelularExterno` y `ResultadoConfirmacion`.

---

## 4. Máquina de estados del pedido

```
                     pagos confirmados ≥ total
   ┌───────────┐  ───────────────────────────►  ┌───────────┐  Preparar  ┌────────────────┐  Listo  ┌───────┐  Entregar  ┌───────────┐
   │ POR_PAGAR │                                │ EN_ESPERA │ ─────────► │ EN_PREPARACION │ ──────► │ LISTO │ ─────────► │ ENTREGADO │
   └─────┬─────┘  ─────── sin ítems de cocina ──┼───────────┼────────────┼────────────────┼───────► └───────┘            └───────────┘
         │                                      └─────┬─────┘            └───────┬────────┘
         │ cancelar (cajera, sin pagos)               │ cancelar (admin)          │ cancelar (admin)
         ▼                                            ▼                          ▼
   ┌───────────┐ ◄────────────────────────────────────┴──────────────────────────┘
   │ CANCELADO │
   └───────────┘
```

- La máquina vive en `packages/dominio`, sin dependencias, y la usan la API y la web.
- Un pedido para comer en el local pasa de `LISTO` a `ENTREGADO` desde la pantalla
  de cocina, cuando la mesera recoge los platos (o desde su celular, P12).
- Toda transición se hace con `UPDATE … WHERE id = $1 AND estado = $esperado`; si no
  afecta filas, responde `409 ESTADO_CAMBIADO` y el cliente recarga.
- Cada transición guarda su marca de tiempo (`pagado_at`, `preparacion_at`,
  `listo_at`, `entregado_at`, `cancelado_at`) y quién la hizo.

---

## 5. Flujos principales

### 5.1. Emparejar un pago con un pedido

Yape no lleva referencia del pedido. Las pistas, de más fuerte a más débil:

1. **Celular de cobros del local:** solo se ofrecen cobros cuyo `device.id` está
   asignado al local del pedido.
2. **Monto exacto** igual al saldo pendiente.
3. **Código de seguridad** de 3 dígitos: la cajera lo compara con la constancia del
   cliente. Puede venir vacío en billeteras que no lo envían.
4. **Hora:** cobros de los últimos 15 minutos (configurable), incluidos los anteriores
   a la creación del pedido.
5. **Nombre** del pagador.

Consulta de candidatos:

```sql
SELECT c.* FROM yallego_cobros c
WHERE c.local_id = $local
  AND c.estado_yallego = 'CAPTURED'
  AND c.ocurrido_at >= now() - make_interval(mins => $ventana_min)
  AND NOT EXISTS (
    SELECT 1 FROM pagos p
    WHERE p.yallego_cobro_id = c.id AND p.estado IN ('RESERVADO', 'CONFIRMADO')
  )
ORDER BY (c.monto = $saldo) DESC, c.ocurrido_at DESC
LIMIT 30;
```

El filtro por negocio lo aplica Row Level Security (§6.3).

Reglas de presentación:

| Situación                                                              | Caja                                                       |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| Un solo candidato con monto exacto y un solo pedido esperando ese monto | Preseleccionado; la cajera toca «Confirmar»               |
| Varios candidatos con monto exacto                                     | Resaltados con «Coincide el monto»; la cajera elige        |
| Otro pedido del local espera el mismo monto                            | Aviso «Hay otro pedido por S/ 25.00 esperando pago»        |
| Ningún candidato                                                       | «Esperando pago…»; la lista se actualiza sola              |

**No hay confirmación automática en el MVP.** Dos pedidos seguidos con el mismo
total son normales y un emparejamiento equivocado entrega comida a quien no pagó.

### 5.2. Confirmar un pago con billetera

La protección contra el doble uso no depende de Yallegó (brecha Y1): la da un
índice único parcial en `pagos (yallego_cobro_id) WHERE estado IN ('RESERVADO',
'CONFIRMADO')`, tomado **antes** de llamar a Yallegó. Un pago `RECHAZADO` deja el
cobro libre para otro pedido.

```
 Caja                       API resto                                 Yallegó
  │ POST /pedidos/{id}/pagos  │                                          │
  │ {cobro_id, Idempotency-Key}                                          │
  │─────────────────────────►│                                          │
  │                          │ TX1:                                     │
  │                          │  SELECT pedido … FOR UPDATE              │
  │                          │  verifica POR_PAGAR y local              │
  │                          │  verifica cobro CAPTURED, sin pago       │
  │                          │  INSERT pago (RESERVADO, cobro_id único) │
  │                          │  COMMIT  ── si viola el único → 409 PAGO_YA_USADO
  │                          │                                          │
  │                          │ POST /v1/transactions/{cobro}/confirm    │
  │                          │ note: "Pedido #0042 · Local Centro · ref:{pago_id}"
  │                          │─────────────────────────────────────────►│
  │                          │◄──────────────── 200 ────────────────────│
  │                          │ TX2:                                     │
  │                          │  pago → CONFIRMADO                       │
  │                          │  cobro → CONFIRMED                       │
  │                          │  pedido.pagado += monto                  │
  │                          │  si pagado ≥ total → EN_ESPERA           │
  │                          │  outbox: pedido.actualizado              │
  │◄──── 200 {pedido} ───────│                                          │
```

Resultados de la llamada a Yallegó:

| Resultado               | Qué hace la API                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200`                   | TX2 y responde `200`                                                                                                   |
| `409`                   | Consulta el cobro. Si está `CONFIRMED` y su nota contiene `ref:{pago_id}`, fue un intento anterior propio que sí llegó: sigue como `200`. Si no, el pago pasa a `RECHAZADO`, el cobro se marca no disponible y responde `409 PAGO_YA_USADO` |
| `401` o `403`           | Pago `RECHAZADO`, conexión marcada con error, aviso al OWNER, responde `502 PROVEEDOR_SIN_PERMISO`                     |
| `404`                   | Pago `RECHAZADO`, responde `409 PAGO_NO_DISPONIBLE`                                                                    |
| Timeout, `5xx` o `429`  | El pago queda `RESERVADO`; se encola un reintento con espera creciente (1, 2, 5, 10, 30 s, hasta 2 min). Responde `202 CONFIRMANDO`. El resultado llega a la caja por socket |

Un pago `RESERVADO` sigue ocupando el cobro: nadie más puede elegirlo. Si tras
2 minutos no se confirma, pasa a `RECHAZADO`, el cobro queda libre de nuevo y la
caja recibe el aviso.

### 5.3. Recepción de webhooks

```
 Yallegó                       API resto                                   Worker
   │ POST /integraciones/yallego/webhooks/{token}                             │
   │──────────────────────────────►│                                          │
   │                               │ 1. busca la conexión por token           │
   │                               │ 2. verifica firma sobre el cuerpo crudo  │
   │                               │    y antigüedad ≤ 5 min                  │
   │                               │ 3. INSERT yallego_eventos                │
   │                               │    (event_id único; si existe, ignora)   │
   │                               │ 4. encola el procesamiento               │
   │◄───────────── 200 ────────────│                                          │
   │                               │─────────────────────────────────────────►│
   │                               │                5. procesa según el tipo  │
```

| Evento                  | Procesamiento                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `transaction.created`   | Inserta o actualiza el cobro en `yallego_cobros`, deduce el local por el celular y emite `cobro.recibido` a la sala de caja del local. Si hay pagos con constancia pendientes, lanza la conciliación (§5.6) |
| `transaction.confirmed` | Actualiza el estado. Si nadie de este sistema lo confirmó, el cobro deja de ofrecerse                  |
| `transaction.disputed`  | Actualiza el estado y, si estaba ligado a un pago, avisa al OWNER                                      |
| `device.offline`        | Recalcula el estado de cobros del local (§5.5). Hoy Yallegó no lo emite (brecha Y2)                    |
| `device.online`         | Igual que el anterior                                                                                  |

La firma, el control de antigüedad y la idempotencia siguen la guía de Yallegó
(`docs/api-publica/07-verificacion-firma.md` y `08-reintentos.md`). Durante una
rotación de secreto se acepta también `X-Yallego-Signature-Previous`.

### 5.4. Consulta de respaldo

Si un webhook se pierde o el backend estuvo caído, la consulta de respaldo trae
los cobros.

- Un job repetible por conexión, cada **10 s**, solo mientras haya un turno de caja
  abierto en algún local del negocio.
- `GET /v1/transactions?status=CAPTURED&from={ahora − 20 min}&limit=100`.
- Inserta lo que falte en `yallego_cobros` (único por `yallego_id`) y emite
  `cobro.recibido` solo para los nuevos.
- Un cobro que llega tarde (el celular estuvo sin internet) trae `occurred_at`
  antiguo y no entra en esta ventana: ese caso lo cubre el webhook, que Yallegó
  reintenta hasta 12 horas.

Uso de la cuota de Yallegó por negocio: 6 consultas de cobros y 2 de celulares por
minuto, de 60 permitidas en el plan Negocio.

### 5.5. Estado del celular de cobros

**Fuentes**

| Fuente                                   | Frecuencia                    |
| ---------------------------------------- | ----------------------------- |
| `GET /v1/devices`                        | Cada 30 s mientras haya turnos abiertos |
| Webhooks `device.offline` y `device.online` | Cuando Yallegó los emita (Y2) |
| Errores al llamar a Yallegó              | En cada llamada               |

**Estado por local** (el peor de sus celulares asignados):

| Estado del local       | Condición                                                                 | Color   |
| ---------------------- | ------------------------------------------------------------------------- | ------- |
| `ACTIVO`               | Al menos un celular asignado `ACTIVE` y `ONLINE`                          | Verde   |
| `DEMORADO`             | Ningún celular `ONLINE`; alguno `DEGRADED` (sin reporte entre 3 y 15 min) | Ámbar   |
| `DESCONECTADO`         | Todos `OFFLINE` (sin reporte por más de 15 min), `PAUSED` o `REVOKED`     | Rojo    |
| `SIN_SERVICIO`         | Tres fallas seguidas al llamar a Yallegó (timeout o `5xx`)                | Rojo    |
| `CONEXION_INVALIDA`    | Yallegó responde `401` o `403` con la clave del negocio                   | Rojo    |
| `SIN_CELULAR`          | El local no tiene celulares asignados                                     | Gris    |

**Transiciones:** al cambiar el estado se guarda una incidencia (inicio, fin), se
emite `cobros.estado` a la sala de caja y de administración del local y, si dura
más de 5 minutos, se envía correo al OWNER. Para evitar parpadeo, `ACTIVO` se
recupera solo tras dos lecturas `ONLINE` seguidas.

**Causas que se muestran hoy** (Yallegó no informa cuál es; brecha Y3): falta de
internet en el celular, celular apagado o sin batería, app de Yallegó cerrada,
permiso de notificaciones desactivado, ahorro de batería activo. Cuando Yallegó
exponga `notification_access`, `battery_optimization_disabled` y la cola
pendiente, se mostrará la causa exacta.

**Tiempo de detección hoy:** el celular reporta cada 2 minutos y Yallegó lo marca
`DEGRADED` a los 3 minutos. Con la consulta cada 30 s, una caída se ve en la caja
entre 3 y 4 minutos después del último reporte (brecha Y4).

### 5.6. Validación con constancia y conciliación posterior

**Habilitación:** la API rechaza `POST …/pagos` con `tipo: CONSTANCIA` si el estado
del local es `ACTIVO`, o si el local no la permite, o si el monto supera el máximo.

**Registro:** el pago se crea `CONFIRMADO` con `verificacion = CONSTANCIA`,
`conciliacion = PENDIENTE` y los datos que dictó la constancia: monto, hora, nombre
y número de operación o código de seguridad, más una observación opcional y el
estado del celular de cobros en ese momento (D11).

**Conciliación:** cuando llega un cobro (webhook o consulta), el worker busca pagos
con constancia pendientes del mismo local:

| Criterio                        | Regla                                                         |
| ------------------------------- | ------------------------------------------------------------- |
| Monto                           | Igual                                                         |
| Hora                            | El cobro ocurrió a ± 10 min de la hora declarada              |
| Código de seguridad             | Si ambos lo tienen, debe coincidir                            |
| Ambigüedad                      | Si hay más de un candidato en cualquier lado, no concilia solo |

Con un solo candidato: confirma el cobro en Yallegó con la nota
`Conciliado · Pedido #0042 · ref:{pago_id}`, liga el pago al cobro y lo marca
`CONCILIADO`. Con ambigüedad, queda para revisión del administrador.

**Sin respaldo:** un job horario marca `SIN_RESPALDO` los pagos con constancia
pendientes de más de 12 horas y avisa al OWNER. No prueba fraude: Yallegó no
recupera cobros ocurridos con su app detenida. El dueño revisa en su app de Yape.

### 5.7. Cocina y pantalla pública en tiempo real

**Salas de Socket.io**

| Sala                     | Quién se une                         | Eventos                                                     |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------- |
| `local:{id}:caja`        | Cajeras con turno en el local        | `pedido.*`, `pago.*`, `cobro.recibido`, `cobros.estado`, `carta.disponibilidad` |
| `local:{id}:cocina`      | Pantallas de cocina del local        | `cocina.pedido` (vista de cocina, sin montos)               |
| `local:{id}:salon`       | Meseros con el local asignado        | `salon.pedido` (pedidos para comer en el local, sin montos) |
| `local:{id}:publica`     | Pantallas públicas del local         | `publica.pedido` (número, nombre abreviado, mesa, estado)   |
| `negocio:{id}:admin`     | OWNER y ADMIN                        | `cobros.estado`, `turno.*`, `yallego.conexion`              |

- Cada superficie recibe una **proyección propia** del pedido. La pantalla pública
  nunca recibe montos, ítems ni datos del pagador (RNF-PRIV-003).
- Los eventos salen de una tabla outbox en la misma transacción que el cambio, y un
  relay los publica en Redis. Así un evento no se pierde si el proceso cae justo
  después del `COMMIT`.
- Cada proyección lleva `version` (contador por pedido). El cliente descarta un
  evento con versión menor a la que ya tiene.
- Al conectar o reconectar, el cliente pide un estado completo
  (`GET /v1/cocina/pedidos`, `GET /v1/publica/pedidos`) y luego aplica eventos.

### 5.8. Numeración diaria de pedidos

```sql
INSERT INTO contadores_pedido (local_id, fecha, ultimo)
VALUES ($local, $fecha_local, 1)
ON CONFLICT (local_id, fecha) DO UPDATE SET ultimo = contadores_pedido.ultimo + 1
RETURNING ultimo;
```

Se ejecuta dentro de la transacción que crea el pedido. La fecha es la del local
(`America/Lima`), no la del servidor. Restricción única
`(local_id, fecha_operacion, numero)` como segunda defensa.

### 5.9. Idempotencia de solicitudes

`POST /v1/pedidos` y `POST /v1/pedidos/{id}/pagos` exigen la cabecera
`Idempotency-Key` (UUID generado por la caja al armar la acción).

- Se guarda en Redis durante 24 h: `idem:{tenant}:{usuario}:{clave}` → respuesta.
- Si llega de nuevo con el mismo cuerpo, se devuelve la respuesta guardada.
- Si llega con otro cuerpo, `422 IDEMPOTENCY_KEY_REUSED`.
- Si la primera aún se procesa, `409 SOLICITUD_EN_CURSO`.
- Respaldo en base de datos: único `(tenant_id, idempotency_key)` en pedidos y pagos.

### 5.10. Tiempo estimado de espera

Hoy la cajera le dice al cliente cuánto demorará su pedido (por ejemplo, 30
minutos). El sistema le sugiere ese tiempo al crear el pedido:

| Situación                                                | Sugerencia                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| Menos de 5 pedidos pasaron a listo en las últimas 2 horas | `tiempo_base_min` del local (20 min por defecto)          |
| 5 o más                                                  | Percentil 75 de `listo_at − pagado_at` de esos pedidos     |

Se redondea a múltiplos de 5 minutos. La cajera puede cambiarlo antes de cobrar; el
valor final se guarda en `pedidos.tiempo_estimado_min` y permite medir qué tan
acertada fue la promesa. La regla vive en `packages/dominio/tiempo-espera.ts`.

---

## 6. Multi-tenancy

### 6.1. Jerarquía

```
Plataforma
 └─ Negocio (tenant)         ← cuenta de Yallegó, usuarios, carta
     └─ Local                ← cajas, cocina, pantalla pública, celulares de cobros, turnos
```

### 6.2. Capa 1 — Aplicación

- `tenant_id` sale siempre del token (usuario o pantalla), nunca del cuerpo ni de la URL.
- Toda operación sobre un local verifica que el usuario lo tenga asignado (o sea
  OWNER o ADMIN) y que una pantalla pertenezca a ese local.

### 6.3. Capa 2 — Base de datos

- Row Level Security en todas las tablas con `tenant_id`, con política
  `tenant_id = current_setting('app.tenant_id')::uuid` y negación por omisión.
- El backend abre cada transacción con `set_config('app.tenant_id', …, true)`, el
  mismo patrón que Yallegó (`withTenant`).
- La recepción de webhooks resuelve el tenant por el token de la URL con una
  consulta sin tenant, y desde ahí trabaja con `withTenant`.

### 6.4. Contexto de plataforma

La consola interna usa un rol de base de datos aparte con `BYPASSRLS`, solo para
las rutas `/platform/v1`, y cada acción queda en auditoría.

---

## 7. Arquitectura del frontend

### 7.1. Una sola app Next.js para todas las superficies

| Ruta           | Superficie        | Forma                                                           |
| -------------- | ----------------- | --------------------------------------------------------------- |
| `/caja`        | Caja              | App web instalable (PWA), vertical, móvil                       |
| `/salon`       | Salón             | Misma app instalable, vertical, para la mesera                  |
| `/cocina`      | Cocina            | Pantalla completa, horizontal, sesión de pantalla vinculada     |
| `/pantalla`    | Pantalla pública  | Pantalla completa, sin interacción, sesión de pantalla vinculada |
| `/admin`       | Administración    | Escritorio, responsiva                                          |

Comparten componentes, tokens de diseño, contratos y cliente de API. Cada
superficie es un grupo de rutas con su propio layout y su propio paquete de
JavaScript, para que la pantalla pública no cargue código de administración.

La consola de plataforma es una app aparte (`apps/plataforma`), como en Yallegó:
otro dominio, lista de IPs permitidas y su propia autenticación con TOTP.

### 7.2. Estado y datos

- **TanStack Query** para datos del servidor, con invalidación por eventos del socket.
- **Estado local** del pedido en armado (carrito) en memoria y respaldado en
  `sessionStorage`, para no perderlo si el celular recarga la página.
- **Sin modo sin conexión** en el MVP: la caja detecta la pérdida de internet,
  bloquea las acciones que necesitan servidor y lo indica (RF-COB-008).

### 7.3. Pantallas fijas

- **Wake Lock API** para que la pantalla no se apague.
- Reconexión del socket con espera creciente y recarga completa de la página cada
  24 h a las 05:00 para liberar memoria en navegadores de TV.
- El token de la pantalla vive en `localStorage` y en una cookie `HttpOnly`; tras un
  corte de luz, la página vuelve sola a su sesión.

---

## 8. Modelo de despliegue

### 8.1. Topología del MVP

```
                        ┌──────────────┐
                        │   Internet   │
                        └──────┬───────┘
                        ┌──────▼───────┐
                        │ Proxy inverso│
                        │  + TLS       │
                        └──┬────────┬──┘
                ┌──────────▼──┐  ┌──▼──────────┐
                │ Web (Next)  │  │ API (Nest)  │◄── webhooks de Yallegó
                └─────────────┘  └──────┬──────┘
                                        │      ┌─────────────┐
                                        ├──────┤ Worker      │
                              ┌─────────┴───┐  └──────┬──────┘
                              ▼             ▼         │
                        ┌──────────┐  ┌──────────┐    │
                        │PostgreSQL│  │  Redis   │◄───┘
                        └──────────┘  └──────────┘
```

Mismo enfoque que Yallegó: contenedores Docker en un VPS, proxy inverso con TLS,
respaldos de PostgreSQL y observabilidad con Prometheus, Loki y Grafana.

### 8.2. Separación de procesos

| Proceso  | Contiene                                                                                    |
| -------- | ------------------------------------------------------------------------------------------- |
| `api`    | HTTP, recepción de webhooks, gateway Socket.io                                              |
| `worker` | Procesamiento de eventos de Yallegó, consulta de respaldo, estado de celulares, reintentos de `confirm`, conciliación, relay del outbox, correos |

### 8.3. Ambientes

| Ambiente     | Yallegó                                         |
| ------------ | ----------------------------------------------- |
| Local        | `tools/yallego-simulador`                        |
| CI           | `tools/yallego-simulador`                        |
| Staging      | Yallegó real, con un negocio y un celular de prueba |
| Producción   | Yallegó real                                    |

---

## 9. Registro de decisiones arquitectónicas

| #      | Decisión                                                                         | Motivo                                                                                       |
| ------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ADR-01 | Monolito modular NestJS, separado de Yallegó                                     | Dominio transaccional pequeño; el restaurante prueba la API pública como cualquier cliente   |
| ADR-02 | Yallegó solo por su API pública, detrás del puerto `ProveedorBilletera`          | Aísla el dominio de cambios de Yallegó; permite simulador y otros proveedores                |
| ADR-03 | Copia local de cobros (`yallego_cobros`)                                         | La lista de la caja no depende de la latencia de Yallegó ni gasta su cuota                   |
| ADR-04 | Webhook más consulta de respaldo, sin el WebSocket de Yallegó                    | El WebSocket exige plan Comercio; el webhook más la consulta cubren pérdidas                 |
| ADR-05 | Restricción única local antes de llamar a `confirm`                              | No depender de la atomicidad de Yallegó (brecha Y1)                                          |
| ADR-06 | La cajera siempre confirma el emparejamiento                                     | Montos repetidos son normales en un restaurante                                              |
| ADR-07 | Una sola app web instalable para caja, salón, cocina, pantalla pública y administración | Un desarrollo para celular, tablet, TV y escritorio, sin tiendas de apps                     |
| ADR-08 | Cocina y pantalla pública como pantallas vinculadas, no usuarios                 | Equipos compartidos, sin contraseñas que se olviden ni se compartan                          |
| ADR-09 | Negocio → local desde el primer sprint, con RLS                                  | Multi-tenant y multi-local son la visión; agregarlos después obliga a migrar todo            |
| ADR-10 | Validación con constancia solo con el celular caído, siempre conciliada          | Mantiene la operación sin abrir una vía cómoda para el fraude                                |
| ADR-11 | Numeración diaria con contador atómico                                           | Varias cajas crean pedidos a la vez                                                          |
| ADR-12 | Eventos de tiempo real desde una tabla outbox                                    | Un evento no se pierde si el proceso cae tras el `COMMIT`                                    |
| ADR-13 | Proyecciones por superficie en el socket                                         | La pantalla pública nunca recibe datos que no debe mostrar                                   |
