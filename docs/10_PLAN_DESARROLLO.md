# 10 — Plan de Desarrollo

> **Duración del sprint:** 2 semanas
> **Sprints hasta MVP:** 8 (16 semanas)
> **Metodología:** iterativa, con entregable funcional al cierre de cada sprint
> **Hito comercial:** demo completa con el simulador de Yallegó al cierre del
> Sprint 5, lista para presentar al restaurante (P8), con la app **resto** instalada
> como APK en Android.
> **Celular:** app nativa desde D29 (2026-10-21): Android con Kotlin y Jetpack Compose
> en el MVP; iOS con Swift y SwiftUI después del piloto. Lo que el plan llamaba «Web —
> Caja (PWA)» ahora es la app Android; la web queda para la administración en la
> computadora, la consola de plataforma y las pantallas fijas.

---

## 1. Visión general

| Sprint | Objetivo                                              | Entregable verificable                                                              |
| ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **1**  | Fundación, autenticación y multi-tenancy              | Un dueño invitado entra, crea locales e invita cajeras con permisos efectivos       |
| **2**  | Carta, mesas y administración base                    | El administrador arma la carta con sus combos y la ve como la verá la caja          |
| **3**  | Caja móvil: pedidos y efectivo                        | Una cajera abre turno, arma un pedido en el celular y lo cobra en efectivo          |
| **4**  | Integración con Yallegó y cobro con Yape              | Un Yape (simulado o real) aparece en la caja y se confirma contra un pedido         |
| **5**  | Cocina, salón y pantalla pública en tiempo real       | Un pedido pagado aparece en cocina, se anuncia en la TV y la mesera o la cajera lo entrega |
| **6**  | Celular de cobros: avisos, constancia y conciliación  | Con el celular apagado la caja avisa, se valida con constancia y luego se concilia  |
| **7**  | Cierre de caja, correcciones, descuentos, reportes y auditoría   | El turno se cierra con arqueo y el dueño ve ventas, constancias y diferencias       |
| **8**  | Endurecimiento, observabilidad, despliegue y piloto   | El restaurante opera en producción con monitoreo activo                             |

---

## 2. Antes del Sprint 1

Tareas sin código, en paralelo al Sprint 1:

- [ ] Elegir nombre comercial y dominio (P1).
- [ ] Fijar la fecha de la reunión para mostrar el sistema al restaurante (P8).
- [ ] Confirmar con el restaurante los equipos de `01_CONTEXTO_Y_ANALISIS.md` §7.4.
- [ ] Responder las preguntas abiertas de `01_CONTEXTO_Y_ANALISIS.md` §11 (P8 y P19).
- [ ] Presentar al comercio el TV o monitor de cocina (D23) y la propuesta de pantalla táctil (D17).
- [ ] *En espera:* carta completa con precios y fotos, cuenta de Yallegó del restaurante y boleta impresa (P5).

---

## 3. Sprint 1 — Fundación, autenticación y multi-tenancy

### Infraestructura

- [ ] Monorepo pnpm + Turborepo según `11_ESTRUCTURA_PROYECTO.md`.
- [ ] `apps/api` (NestJS), `apps/web` (Next.js 15), `packages/contracts`, `packages/dominio`, `packages/design-tokens`, `packages/ui`, configuración compartida.
- [ ] Docker Compose local: PostgreSQL 16, Redis 7, Mailpit.
- [ ] CI: lint, typecheck, test, build, gitleaks, auditoría de dependencias.
- [ ] Commitlint con Conventional Commits.

### Base de datos

- [ ] Prisma con negocios, locales, usuarios, membresías, tokens y auditoría.
- [ ] RLS con política estándar y `withTenant` / `withoutTenantScope`.
- [ ] Prueba automática de aislamiento entre negocios.

### Autenticación y equipo

- [ ] Ingreso, renovación con rotación y detección de reutilización, cierre de sesión.
- [ ] Recuperación de contraseña e invitaciones por correo.
- [ ] Bloqueo tras intentos fallidos.
- [ ] Roles OWNER, ADMIN, CAJERO y asignación de locales.
- [ ] Guardas de rol y de local (`X-Local-Id`).

### Plataforma

- [ ] Consola mínima: alta de negocio e invitación al OWNER.

### Web

- [ ] Ingreso, activación de cuenta, recuperación.
- [ ] Administración: locales y equipo.
- [ ] Pantalla de carga, «Algo salió mal», 404 y sesión vencida (09 §15).
- [ ] Tokens de movimiento y transiciones entre pantallas (09 §9).

### Criterios de aceptación

- [ ] Un dueño invitado activa su cuenta, crea dos locales e invita una cajera asignada a uno.
- [ ] La cajera no puede operar en el otro local (`403 LOCAL_NO_ASIGNADO`).
- [ ] Ninguna ruta devuelve datos de otro negocio (suite de aislamiento en verde).
- [ ] La CI pasa completa en cada PR.

---

## 4. Sprint 2 — Carta, mesas y administración base

### Backend

- [ ] Categorías, productos (con costo de táper) y combos con sus platos fijos.
- [ ] Disponibilidad por local (`producto_locales`) y agotado.
- [ ] `GET /v1/carta?local_id=` con versión para caché.
- [ ] Zonas y mesas.
- [ ] Subida de fotos (almacenamiento de objetos) con redimensionado.
- [ ] Configuración del local (`PATCH /v1/locales/{id}`).
- [ ] Datos semilla de la «Cevichería Demo».

### Web

- [ ] Administración de carta con orden por arrastre.
- [ ] Vista previa de la carta como la ve la caja.
- [ ] Zonas y mesas.
- [ ] Logo y color de acento del negocio.

### Criterios de aceptación

- [ ] El administrador crea el combo «Mixto» con sus platos y lo ve en la vista previa.
- [ ] Un producto deshabilitado en un local no aparece en la carta de ese local.
- [ ] Cambiar un precio queda en auditoría.

---

## 5. Sprint 3 — Caja móvil: pedidos y efectivo

### Backend

- [ ] Máquina de estados del pedido en `packages/dominio`, con pruebas de cada transición.
- [ ] Turnos: abrir, consultar actual.
- [ ] `POST /v1/pedidos` con numeración diaria atómica e idempotencia.
- [ ] Edición y cancelación de pedidos `POR_PAGAR`.
- [ ] Pago en efectivo con vuelto; paso a `PENDIENTE` al cubrir el total.
- [ ] Tiempo estimado de espera sugerido (`packages/dominio/tiempo-espera.ts`).
- [ ] Táper automático en pedidos para llevar.
- [ ] Listado de pedidos del día por estado.
- [ ] Outbox y relay de eventos; gateway Socket.io con salas de caja.
- [ ] Sesión de la app: refresh token en el cuerpo con `X-Cliente: android` (`07_SEGURIDAD_AUTH.md` §2.2).
- [ ] `packages/contracts` publica el OpenAPI generado desde `zod`.
- [ ] `GET /v1/app/version` con versión mínima y última por plataforma.

### App Android — Caja

- [ ] `apps/android`: proyecto en Android Studio con Kotlin, Jetpack Compose y Material 3 con el tema de la marca; navegación, inyección de dependencias y cliente de la API generado desde el OpenAPI.
- [ ] Sesión: ingreso, renovación y cierre, con el refresh token en el Android Keystore.
- [ ] CI: compilación, lint y pruebas con Gradle; APK firmado de prueba como artefacto del PR. La clave de firma vive en los secretos de la CI, nunca en el repositorio.
- [ ] Ícono adaptativo y pantalla de carga.
- [ ] Ingreso, elección de local, apertura de turno.
- [ ] Inicio con la carta, categorías, hoja del ítem (cantidad y nota), barra de pedido.
- [ ] Resumen: para comer aquí o para llevar; nombre y zona para comer aquí; ítems editables.
- [ ] Cobro en efectivo.
- [ ] Confirmación con número, detalle, total y tiempo estimado ajustable.
- [ ] Pestaña Pedidos.
- [ ] Detección de falta de internet en el propio celular, con reintento automático.
- [ ] Esqueletos, diálogos de confirmación y avisos breves.
- [ ] Microinteracciones de la caja: agregar plato, contador del pedido y confirmación con check.

### Criterios de aceptación

- [ ] Dos cajas crean 50 pedidos simultáneos en el mismo local sin números repetidos (prueba de carga).
- [ ] Reenviar la misma solicitud de creación devuelve el mismo pedido.
- [ ] Un pedido cobrado en efectivo queda `PENDIENTE` y se ve en la pestaña Pedidos de otra caja sin recargar.
- [ ] La app funciona en un Android 10 de gama media a 360 dp de ancho y abre en menos de 2 s.

---

## 6. Sprint 4 — Integración con Yallegó y cobro con Yape

### Paquetes y herramientas

- [ ] `packages/yallego-client`: cliente tipado de la API pública y verificación de firma.
- [ ] `tools/yallego-simulador`: transacciones, confirm (incluido `409`), dispositivos, webhooks firmados, y una pantalla para «simular un Yape» y apagar un celular.

### Backend

- [ ] Puerto `ProveedorBilletera` y adaptadores HTTP y en memoria.
- [ ] Conexión: validar clave, registrar webhook, cifrar credenciales, deshacer si falla.
- [ ] Celulares de Yallegó y asignación a locales.
- [ ] Recepción de webhooks: firma, antigüedad, bandeja idempotente, cola.
- [ ] Copia local de cobros y emisión de `cobro.recibido`.
- [ ] Consulta de respaldo cada 10 s con turnos abiertos.
- [ ] Candidatos con preselección y aviso de montos repetidos.
- [ ] Confirmación con reserva local, llamada a `confirm`, manejo de `409`, reintentos y expiración de reservas.

### Web

- [ ] Administración → Configuración → Yallegó: conectar, celulares, probar, con guía paso a paso.

### App Android

- [ ] Caja: pestaña Yape con «Últimos pagos», detalle del pago y resultados.

### Criterios de aceptación

- [ ] Un Yape simulado aparece en la caja en menos de 1.5 s y se confirma contra el pedido.
- [ ] Dos cajas que confirman el mismo cobro a la vez: una gana, la otra recibe «Este pago ya fue usado».
- [ ] Con el simulador respondiendo lento, el pago queda «Confirmando…» y se resuelve solo.
- [ ] Con los webhooks cortados, la consulta de respaldo trae el cobro en menos de 15 s.
- [ ] Prueba con Yallegó real en staging: un Yape real de S/ 1.00 confirma un pedido.

---

## 7. Sprint 5 — Cocina, salón y pantalla pública en tiempo real

### Backend

- [ ] Dispositivos vinculados (celular de cocina, monitor de cocina y pantalla pública): solicitud con código y secreto, aprobación del ADMIN, canje del token, cambio de equipo y revocación (D27).
- [ ] Proyecciones de cocina y pública; salas por local.
- [ ] Acciones de cocina con control de versión y deshacer.
- [ ] Entrega desde la caja; ocultar listos por tiempo.
- [ ] Rol MESERO, proyección y sala de salón; entrega desde el celular de la mesera.
- [ ] Búsqueda de pedidos por número.
- [ ] Pedidos sin ítems de cocina directo a `LISTO`.
- [ ] Módulo `notificaciones`: registro del token FCM por sesión y aviso de pedido listo a la mesera con la app en segundo plano.

### Web

- [ ] `/vincular`: la pantalla muestra código y QR, los renueva al vencer y entra sola al aprobarse.
- [ ] Monitor de cocina en solo lectura: columnas que se leen de lejos.
- [ ] Pantalla pública: columnas, animación y sonido de listo, marca del negocio, Wake Lock, reconexión.
- [ ] «Toca para activar el sonido» en el monitor de cocina y la pantalla pública.

### App Android

- [ ] Aprobación de pantallas desde la app del administrador: escanear el QR con la cámara (D27).
- [ ] Cocina en el celular: vinculación como dispositivo, lista vertical, colores por tipo y demora, sonido, deshacer, cancelados y pantalla siempre encendida.
- [ ] Cocina en pantalla táctil (propuesta): la app en una tablet en horizontal, con columnas.
- [ ] Caja: pestaña Listos con «Entregar» y búsqueda por número.
- [ ] Salón (celular de la mesera): pedidos con nombre, zona y detalle, aviso de listos con notificación y «Entregado».
- [ ] Permiso de notificaciones con explicación previa (RF-SIS-007).
- [ ] APK firmado de la demo y guía de instalación de un paso.

### Criterios de aceptación

- [ ] Un pedido pagado aparece en cocina en menos de 1 s y en la pantalla pública al pasar a preparación.
- [ ] Un pedido para comer en el local pasa a listo, el celular de la mesera vibra con nombre y zona, y al marcarlo entregado sale de la pantalla pública.
- [ ] Desenchufar y volver a enchufar la TV la deja en su pantalla sin intervención.
- [ ] La pantalla pública no recibe montos ni nombres de pagadores (verificado en el tráfico de red).
- [ ] **Demo de punta a punta con el simulador lista para presentar al restaurante.**

---

## 8. Sprint 6 — Celular de cobros: avisos, constancia y conciliación

### Backend

- [ ] Consulta de celulares cada 30 s y cálculo del estado por local con histéresis.
- [ ] Incidencias y correo al OWNER tras 5 min.
- [ ] Manejo de `device.offline` y `device.online` (Yallegó los emite desde `v0.1.0`, Y2).
- [ ] Estados `SIN_SERVICIO` y `CONEXION_INVALIDA` a partir de errores de Yallegó.
- [ ] Pago con constancia habilitado solo según el estado de cobros; observación opcional y estado del celular guardado.
- [ ] Conciliación al llegar cobros; revisión manual; `SIN_RESPALDO` a las 12 h con aviso.

### App Android

- [ ] Caja: chip, avisos fijos con causas, sonido y vibración, pestaña Constancia.
- [ ] Notificación de cobros caídos a la caja y al dueño con la app en segundo plano.

### Web

- [ ] Administración: estado de cobros por local, incidencias, constancias por conciliar.

### Criterios de aceptación

- [ ] Apagar el celular simulado muestra «Demorado» en la caja en menos de 4 min y «Desconectado» al pasar el umbral.
- [ ] Con el celular activo, la API rechaza una constancia (`422`).
- [ ] Al reencender, un cobro atrasado con el mismo monto y hora concilia solo la constancia.
- [ ] Una constancia sin cobro queda «Sin respaldo» y el dueño recibe el correo.

---

## 9. Sprint 7 — Cierre de caja, correcciones, descuentos, reportes y auditoría

### Backend

- [ ] Movimientos de caja; cierre con arqueo; bloqueo con pendientes; cierre por admin.
- [ ] Cierre del día: el administrador valida u observa los turnos.
- [ ] Observaciones y correcciones: reporte desde salón o caja; resolución en caja (corregir con diferencia, cancelar con devolución, sin cambios); la corrección entra primero en cocina.
- [ ] Descuentos, promociones y cortesías: configuración, aplicación automática y manual, reporte y revisión al cierre.
- [ ] Pagos divididos y mixtos; diferencia de monto.
- [ ] Reportes de ventas, productos, cocina y constancias; exportación CSV.
- [ ] Consulta de auditoría.
- [ ] Reemplazo de clave y desconexión de Yallegó.

### App Android

- [ ] Caja: turno de caja y cierre; observaciones por resolver; aplicar descuentos y cortesías.
- [ ] Salón: agregar observación y ver su resolución.
- [ ] Dueño: hoy, pedidos, cierre del día completo (validar u observar turnos) y aviso de cierre pendiente.

### Web

- [ ] Administración: descuentos y promociones, cierre del día, reportes y auditoría.

### Criterios de aceptación

- [ ] Un turno con ventas mixtas cierra con el esperado correcto (prueba con datos de un día real del piloto).
- [ ] No se puede cerrar con un pedido por pagar.
- [ ] El administrador valida desde su celular el cierre de un día con dos turnos, una constancia y una cancelación.
- [ ] Una observación «pedido equivocado» se corrige: la corrección entra primero en cocina, la diferencia se cobra o se devuelve y la venta no se cuenta dos veces.
- [ ] Un «martes de ceviche −20 %» se aplica solo y el Yape que se empareja es el total con descuento.
- [ ] El reporte de ventas separa efectivo, Yape verificado y constancia, y cuadra con los turnos.

---

## 10. Sprint 8 — Endurecimiento, observabilidad, despliegue y piloto

- [ ] Métricas, tableros y alertas (`03_REQUERIMIENTOS_NO_FUNCIONALES.md` §7).
- [ ] Prueba de carga: 120 pedidos por hora por local en 20 locales simultáneos.
- [ ] Revisión de seguridad: aislamiento, webhooks, tokens de pantalla, cabeceras.
- [ ] Despliegue de producción, respaldos y restauración probada.
- [ ] Runbook de incidentes: Yallegó caído, celular caído, webhooks rechazados, cola detenida.
- [ ] Consola de plataforma: estado de Yallegó y cobros por negocio, suspensión, suscripciones.
- [ ] Puesta en marcha en el restaurante piloto (`08_UX_FLUJOS.md` §3) y capacitación.
- [ ] Una semana de acompañamiento en hora punta.
- [ ] App Android en Google Play (prueba interna) para el piloto; aviso de versión nueva y versión mínima.
- [ ] Plan de la app de iOS (Swift y SwiftUI) con los mismos flujos, para después del piloto.

### Criterios de aceptación

- [ ] El piloto opera una semana con 0 cobros usados dos veces y 0 constancias sin respaldo no explicadas.
- [ ] Las métricas de `01_CONTEXTO_Y_ANALISIS.md` §9.1 se miden desde el tablero.

---

## 11. Dependencias de Yallegó

Trabajo en el repositorio de Yallegó que mejora o habilita este proyecto (brechas
de `01_CONTEXTO_Y_ANALISIS.md` §4.3). Las tareas INT son del plan de Yallegó
(`docs/17_PLATAFORMA_DESARROLLADORES.md`): fase 1 en su Sprint 19 y fase 2 en su
Sprint 20.

| #   | Cambio en Yallegó                                                            | Estado                        | Tarea en Yallegó | Necesario para      | Si no llega a tiempo                              |
| --- | ---------------------------------------------------------------------------- | ----------------------------- | ---------------- | ------------------- | ------------------------------------------------- |
| Y1  | `confirm` y `dispute` atómicos                                               | En producción (`v0.1.0`)      | —                | Sprint 4            | La restricción única local cubre el caso          |
| Y2  | Emitir `device.offline` y `device.online`                                    | En producción (`v0.1.0`)      | —                | Sprint 6            | Consulta cada 30 s                                |
| Y3  | Exponer permisos, ahorro de batería y cola del celular en `GET /v1/devices`  | Pendiente                     | INT-017 (v0.2)   | Sprint 6            | Aviso con causas posibles                         |
| Y4  | Heartbeat más frecuente (30–60 s) para detectar caídas rápido                | Pendiente                     | INT-017 (v0.2)   | Sprint 8            | Detección en 3 a 4 min                            |
| Y5  | Modo de pruebas (`yk_test_`) y simulación de cobros                          | Propuesta                     | INT-010, INT-011 | Sprint 4            | Simulador propio                                  |
| Y6  | Consulta de alcances de una clave (`GET /v1/me`)                             | Propuesta                     | INT-003          | Sprint 4            | `transactions:write` se comprueba al primer cobro |
| Y7  | Webhooks a desarrollo local y evento de prueba por tipo                      | Propuesta                     | INT-013, INT-014 | Sprint 4            | Túnel o simulador                                 |
| Y8  | Plin y BIM verificados con notificaciones reales                             | Parcial                       | INT-020 (v0.2)   | v0.2 de Yallegó     | Solo Yape y efectivo                              |
| Y9  | Cobros esperados (`payment-intents`)                                         | Diferida                      | INT-022 (v1.0)   | v1.0                | Emparejamiento local                              |
| Y10 | Límite por credencial en vez de por IP                                       | Propuesta                     | INT-001          | Más de ~30 negocios | Sin efecto en el piloto                           |
| Y11 | Claves de prueba en cualquier plan y cupo de claves separado del de webhooks | Propuesta, decisión comercial | INT-006          | Sprint 4            | El restaurante contrata Negocio                   |
| Y12 | `Idempotency-Key` y `409` con el estado del cobro                            | Propuesta                     | INT-004          | Sprint 4            | Consulta del cobro tras un `409`                  |
| Y13 | Comercio (`tenant_id`) en el sobre del webhook                               | Propuesta                     | INT-002          | —                   | URL con token por conexión                        |

Y1 e Y2 están en producción desde Yallegó `v0.1.0` (2026-10-13). Ninguna de las
demás bloquea el MVP: todas tienen una mitigación propia.

---

## 12. Fuera del MVP

| Funcionalidad                                     | Versión |
| ------------------------------------------------- | ------- |
| Boletas y facturas electrónicas                   | v0.2    |
| Impresión de la boleta simple y de comandas       | Según P5 |
| Opciones a elegir en productos (RF-CAR-004)       | v0.2    |
| Números de mesa (RF-MES-002)                      | Cuando un restaurante los use |
| Estaciones de cocina                              | v0.2    |
| PIN de administrador y foto de la constancia       | v0.2    |
| Registro autoservicio y cobro automático de la suscripción | v0.2 |
| Bloqueo de caja con PIN                           | v0.2    |
| Anuncio por voz en la pantalla pública            | v0.2    |
| App de iOS (Swift y SwiftUI)                      | Después del piloto |
| Carta con QR para que el cliente pida             | v1.0    |
| Cobros esperados en Yallegó                       | v1.0    |
| Integraciones con delivery                        | v1.0    |
