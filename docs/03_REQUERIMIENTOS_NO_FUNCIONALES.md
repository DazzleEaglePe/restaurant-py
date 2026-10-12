# 03 — Requerimientos No Funcionales

> **Convención de IDs:** `RNF-[CATEGORÍA]-[NNN]`
> **Horario de atención:** de 10:00 a 23:00, hora de Lima. **Hora punta:** de 12:00
> a 15:00 y de 19:00 a 22:00. Los objetivos de disponibilidad y los despliegues se
> miden contra estas franjas.

---

## 1. Rendimiento

| ID           | Requerimiento                                                                                                     | Objetivo         |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------- |
| RNF-REN-001  | Desde que llega el webhook de Yallegó hasta que el pago aparece en la caja                                        | < 1.5 s p95      |
| RNF-REN-002  | Confirmar un pago con billetera (toque de la cajera → respuesta), incluida la llamada a Yallegó                    | < 2 s p95        |
| RNF-REN-003  | Desde que cambia el estado de un pedido hasta que se ve en cocina y en la pantalla pública                         | < 1 s p95        |
| RNF-REN-004  | Crear un pedido                                                                                                   | < 500 ms p95     |
| RNF-REN-005  | Primera carga de la caja en un Android de gama media con 4G                                                       | < 3 s            |
| RNF-REN-006  | Cargas siguientes de la caja (app instalada, recursos en caché)                                                   | < 1 s            |
| RNF-REN-007  | Detección de una caída del celular de cobros, desde su último reporte                                             | ≤ 4 min hoy; objetivo ≤ 60 s cuando Yallegó lo permita (brecha Y4) |

---

## 2. Capacidad y escalabilidad

| ID          | Requerimiento                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| RNF-ESC-001 | Un local soporta 120 pedidos por hora en hora punta con 3 cajas, 2 meseras, 2 pantallas de cocina y 2 públicas. El piloto es muy concurrido pero sin cifras: su volumen real se mide en las primeras semanas. |
| RNF-ESC-002 | La plataforma soporta 200 locales activos en el primer año con una sola instancia de API y una de worker. |
| RNF-ESC-003 | La API no guarda estado en memoria: se puede escalar horizontalmente, con Socket.io sobre el adaptador de Redis. |
| RNF-ESC-004 | Las consultas a Yallegó por negocio no superan 10 por minuto (el plan Negocio permite 60).              |

---

## 3. Disponibilidad y fiabilidad

| ID           | Requerimiento                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-DISP-001 | Disponibilidad mensual ≥ 99.5 % en horario de atención.                                                                               |
| RNF-DISP-002 | Si Yallegó no está disponible, el cobro en efectivo, la validación con constancia, la cocina y la pantalla pública siguen funcionando. |
| RNF-DISP-003 | Ningún reintento crea un pedido o un pago duplicado (claves de idempotencia).                                                          |
| RNF-DISP-004 | Un cobro de Yallegó nunca queda aplicado a dos pedidos, aunque Yallegó acepte dos confirmaciones (brecha Y1).                         |
| RNF-DISP-005 | Cada evento de Yallegó tiene efecto una sola vez, aunque llegue varias veces.                                                          |
| RNF-DISP-006 | Si el backend cae, al volver recupera los cobros perdidos: Yallegó reintenta el webhook y la consulta de respaldo los trae.            |
| RNF-DISP-007 | Caja, cocina y pantalla pública se reconectan solas y se resincronizan al recuperar internet, sin recargar a mano.                    |
| RNF-DISP-008 | Los despliegues se hacen fuera de hora punta y sin cortar conexiones activas por más de 10 s.                                          |
| RNF-DISP-009 | Respaldos diarios de la base de datos con recuperación a un punto en el tiempo de los últimos 7 días.                                  |

---

## 4. Seguridad

| ID          | Requerimiento                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| RNF-SEG-001 | Todo el tráfico va por HTTPS/WSS con TLS 1.2 o superior.                                                            |
| RNF-SEG-002 | La clave de API y el secreto del webhook de Yallegó se guardan cifrados con AES-256-GCM y nunca se devuelven al cliente. |
| RNF-SEG-003 | Ninguna llamada a Yallegó sale de un navegador o de un celular; solo del backend.                                   |
| RNF-SEG-004 | El aislamiento entre negocios se aplica en la aplicación y con Row Level Security en PostgreSQL.                     |
| RNF-SEG-005 | Las contraseñas se guardan con Argon2id.                                                                             |
| RNF-SEG-006 | Los tokens de pantalla son aleatorios de 256 bits, se guardan solo como hash y se pueden revocar.                    |
| RNF-SEG-007 | Límite de solicitudes por IP y por usuario en autenticación y en la recepción de webhooks.                          |

Detalle en `07_SEGURIDAD_AUTH.md`.

---

## 5. Privacidad y cumplimiento

| ID           | Requerimiento                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| RNF-PRIV-001 | Cumplimiento de la Ley 29733 de Protección de Datos Personales y su reglamento.                                                |
| RNF-PRIV-002 | El nombre del pagador se cifra en reposo y solo lo ve la caja y la administración del negocio.                                 |
| RNF-PRIV-003 | La pantalla pública, la de cocina y la vista de salón nunca reciben montos ni datos del pagador, ni siquiera en el tráfico de red.               |
| RNF-PRIV-004 | La copia local de cobros se depura a los 90 días; los pagos conservan solo el nombre abreviado del pagador. Sujeto a revisión legal. |
| RNF-PRIV-005 | Los registros de la aplicación no contienen nombres de pagadores, claves ni tokens.                                            |

---

## 6. Mantenibilidad

| ID           | Requerimiento                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| RNF-MANT-001 | TypeScript estricto en todo el código.                                                                          |
| RNF-MANT-002 | Cobertura ≥ 90 % en el dominio: máquina de estados del pedido, cálculo de totales, emparejamiento y conciliación. |
| RNF-MANT-003 | Pruebas de integración de los flujos de cobro contra el simulador de Yallegó en la CI.                         |
| RNF-MANT-004 | Toda llamada a Yallegó pasa por un solo puerto (`ProveedorBilletera`), sustituible sin tocar el dominio.       |
| RNF-MANT-005 | Migraciones versionadas y reversibles; nunca cambios manuales en producción.                                   |

---

## 7. Observabilidad

| ID          | Requerimiento                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-OBS-001 | Métricas Prometheus: latencia webhook → caja, latencia de `confirm`, respuestas `409` de Yallegó, pagos manuales, locales sin cobros activos, profundidad de colas. |
| RNF-OBS-002 | Registros estructurados en JSON con `request_id`, `tenant_id` y `local_id`.                                                          |
| RNF-OBS-003 | Alertas operativas: webhooks rechazados por firma, errores de Yallegó por encima del 5 % en 5 min, colas detenidas, pagos «Confirmando…» por más de 2 min. |
| RNF-OBS-004 | Comprobación de salud de la API (`/v1/health`) y de sus dependencias (`/v1/health/ready`).                                            |

---

## 8. Usabilidad y accesibilidad

| ID           | Requerimiento                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| RNF-USA-001  | Cobrar con Yape un pedido ya armado toma como máximo 3 toques cuando el pago ya llegó.                            |
| RNF-USA-002  | En la caja, los objetivos táctiles miden al menos 48 × 48 px; en cocina, al menos 56 × 56 px en celular y 64 × 64 px en pantalla. |
| RNF-USA-003  | En la pantalla pública, el número de pedido se lee a 6 metros: al menos 96 px de alto en 1080p.                   |
| RNF-USA-004  | Contraste WCAG 2.2 AA en toda la interfaz; AAA para números de pedido y montos.                                   |
| RNF-USA-005  | El estado nunca se comunica solo con color: también con texto o ícono.                                            |
| RNF-USA-006  | Interfaz en español de Perú; montos en soles con dos decimales (`S/ 25.00`); horas en 24 h y zona del local.      |
| RNF-USA-007  | La caja se usa con una sola mano: acciones principales en la mitad inferior de la pantalla.                       |

---

## 9. Compatibilidad

| Superficie        | Requisito                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Caja              | Android 10+ con Chrome 110+; iPhone con iOS 16.4+ y Safari, instalada como app web. Ancho mínimo 360 px.     |
| Cocina            | Celular en vertical (MVP): Android 10+ con Chrome 110+ o iPhone con iOS 16.4+. Propuesta: tablet de 10" o monitor táctil en horizontal. |
| Pantalla pública  | TV o monitor de 1080p con navegador basado en Chromium (Android TV, Google TV o mini PC). Sin interacción.   |
| Administración    | Últimas dos versiones de Chrome, Edge, Firefox y Safari en escritorio. El cierre del día se revisa completo desde el celular del administrador. |

---

## 10. Restricciones tecnológicas

| ID          | Restricción                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------- |
| RNF-TEC-001 | Se consume Yallegó solo a través de su API pública (`/v1`). Nunca su base de datos ni rutas internas. |
| RNF-TEC-002 | Stack alineado con Yallegó: NestJS, Prisma, PostgreSQL 16, Redis 7, BullMQ, Socket.io y Next.js.   |
| RNF-TEC-003 | Una sola app web instalable para caja, cocina, pantalla pública y administración. Sin apps nativas en el MVP. |

---

## 11. Restricciones operativas

| ID          | Restricción                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| RNF-OPE-001 | El local necesita internet estable para caja, cocina, pantalla pública y celular de cobros.                     |
| RNF-OPE-002 | El celular de cobros debe tener la app de Yallegó abierta, con permiso de notificaciones y sin ahorro de batería. |
| RNF-OPE-003 | Sin internet en la caja no se registran pedidos. El modo sin conexión queda fuera del MVP.                      |
| RNF-OPE-004 | El negocio necesita una cuenta de Yallegó con acceso a la API (plan Negocio o superior).                         |

---

## 12. Matriz de atributos de calidad priorizados

| Prioridad | Atributo                  | Por qué                                                                                    |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| 1         | Corrección de pagos       | Un pago aplicado dos veces o un pedido sin pagar en cocina es pérdida directa de dinero    |
| 2         | Disponibilidad en punta   | Si la caja se cae a la 1 p. m., el restaurante deja de vender                              |
| 3         | Rapidez percibida         | La cola no puede crecer por culpa del sistema                                              |
| 4         | Aislamiento entre negocios | Es un producto multi-tenant con datos de pagos                                            |
| 5         | Simplicidad de uso        | El personal cambia seguido y aprende en el mismo turno                                     |
| 6         | Mantenibilidad            | Equipo pequeño; Yallegó evoluciona en paralelo                                            |
