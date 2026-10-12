# 01 — Contexto y Análisis

> **Estado:** aprobado para iniciar diseño · 2026-10-11
> **Nombre comercial:** por definir. En el código se usa el nombre de trabajo `resto`.
> **Fuentes:** tablero de Excalidraw del proyecto, conversación de definición del
> 2026-10-11 y el repositorio de Yallegó (`~/Desktop/yallego`).

---

## 1. Resumen ejecutivo

Sistema multi-tenant para restaurantes que **cobran antes de cocinar**. La cajera
toma el pedido en su celular, el cliente paga con Yape o en efectivo, el sistema
valida el pago y recién entonces el pedido aparece en la pantalla de cocina. Una
segunda pantalla, frente a los clientes, muestra qué pedidos están en preparación
y cuáles ya están listos.

La validación de pagos con billeteras digitales no se construye aquí: la hace
**Yallegó**, que captura las notificaciones de Yape en el celular de cobros del
local y las expone por API y webhooks. Este sistema es un integrador más de
Yallegó y usa solo su API pública.

El primer cliente es un restaurante al que se le presentará el sistema. El
producto se diseña desde el inicio para venderse a muchos restaurantes y a cadenas
con varios locales.

### 1.1. Cómo trabaja hoy el restaurante piloto

1. El cliente se acerca a la cajera, que atiende en un escritorio, y pide. Por
   ejemplo: dos mixtos, un ceviche y dos Coca-Cola personales.
2. La cajera le dice el total. El cliente paga con Yape o en efectivo y le muestra
   la constancia.
3. La cajera le entrega una **boleta simple** firmada (no es un comprobante
   electrónico) con el detalle y los montos, y le dice el tiempo de espera
   aproximado, por ejemplo 30 minutos.
4. **Para llevar:** el cliente se va y vuelve. Le devuelve la boleta a la cajera y
   ella le entrega su pedido.
5. **Para comer en el local:** el cliente se sienta. Cuando los platos salen de
   cocina, una **mesera** los alista y los lleva a su mesa.

El sistema reemplaza la verificación del pago a ojo y el registro en papel, ordena
la cocina y avisa a la cajera y a la mesera cuando un pedido está listo.

---

## 2. El problema

### 2.1. Constancias falsas

En el mostrador, la cajera valida un Yape mirando la pantalla del celular del
cliente. Existen aplicaciones que generan constancias falsas idénticas a las
reales. El negocio descubre el fraude al cerrar el día, cuando el dinero no está.

### 2.2. La cajera depende del celular del dueño

Para confirmar que el pago llegó, alguien tiene que revisar el celular que recibe
los Yape. Si ese celular lo tiene el dueño, la cola se detiene.

### 2.3. Cocina sin orden

Los pedidos llegan a cocina en papel o de viva voz. No hay forma de saber cuál se
pagó primero, cuánto tiempo lleva esperando ni si es para llevar.

### 2.4. El cliente no sabe cuándo está su pedido

El cliente pregunta varias veces o se aglomera frente al mostrador.

### 2.5. Cuadre de caja manual

Al cierre, el efectivo y los Yape se cuentan a mano y se comparan con lo que la
cajera recuerda haber vendido.

---

## 3. Propuesta de valor

| Para quién | Qué gana                                                                          |
| ---------- | --------------------------------------------------------------------------------- |
| Dueño      | Ningún pedido entra a cocina sin un pago verificado; cuadre de caja automático    |
| Cajera     | Toma el pedido y ve llegar el Yape en el mismo celular; no depende de nadie       |
| Cocina     | Una pantalla con los pedidos pagados, en orden, con su tiempo y tipo              |
| Mesera     | Sabe qué pedido de mesa está listo sin ir a preguntar a cocina                    |
| Cliente    | Ve en una pantalla cuándo su pedido está listo                                    |

### 3.1. Diferenciadores

1. **Pago verificado contra la notificación real del banco**, no contra la constancia
   del cliente. Es la capacidad central de Yallegó.
2. **Caja completa en un celular.** No requiere computadora, impresora ni POS.
3. **Avisos cuando el celular de cobros falla**, con la causa y qué revisar.
4. **Multi-local desde el primer día.**

---

## 4. Relación con Yallegó

### 4.1. Qué usamos

| Necesidad                              | Pieza de Yallegó                                                  |
| -------------------------------------- | ----------------------------------------------------------------- |
| Enterarse de un Yape al instante        | Webhook `transaction.created` firmado con HMAC-SHA256             |
| Lista de pagos recientes                | `GET /v1/transactions?status=CAPTURED&from=…`                     |
| Marcar un pago como usado por un pedido | `POST /v1/transactions/{id}/confirm` con nota del pedido          |
| Saber a qué local pertenece un pago     | `device.id` de cada transacción, asignado a un local              |
| Estado del celular de cobros            | `GET /v1/devices` (`connectivity`, `last_seen_at`)                |
| Registrar el webhook sin intervención   | `POST /v1/webhooks` con la clave del restaurante                  |

### 4.2. Qué no hace Yallegó

- **No conoce pedidos.** Una notificación de Yape trae monto, nombre del pagador y
  código de seguridad. No hay número de pedido que unir. El emparejamiento pago ↔
  pedido es responsabilidad de este sistema (ver `04_ARQUITECTURA_SOFTWARE.md` §5.1).
- **No responde «¿se pagó el pedido X?».** El pago llega cuando el cliente lo hace.
  Lo que el tablero llama «validación exitosa, código 000» corresponde a que
  `confirm` responda `200`.
- **No acepta tarjetas.** No aplica: el restaurante no acepta tarjeta.

### 4.3. Brechas encontradas en Yallegó

Revisadas en el código de Yallegó el 2026-10-11. Se registran como dependencias
en `10_PLAN_DESARROLLO.md` §11.

| #   | Brecha                                                                                     | Impacto en el restaurante                                     | Mitigación aquí                                    |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------- |
| Y1  | `confirm` no es atómico: dos confirmaciones simultáneas del mismo cobro pueden pasar las dos | Un Yape podría aplicarse a dos pedidos                        | Restricción única local sobre el cobro             |
| Y2  | `device.offline` y `device.online` están documentados pero no se emiten                     | No hay aviso inmediato cuando cae el celular de cobros        | Consulta de `GET /v1/devices` cada 30 s            |
| Y3  | El celular reporta permisos y cola, pero la API no los expone                               | No se puede decir «perdió el permiso de notificaciones»       | Mensaje con la lista de causas posibles            |
| Y4  | Heartbeat cada 2 min; «degradado» a los 3 min y «desconectado» a los 15                     | Una caída se detecta en 3 a 4 minutos, no en segundos         | Ninguna; se pide a Yallegó un modo más rápido      |
| Y5  | No hay modo de pruebas ni forma de simular un cobro                                         | No se puede desarrollar sin yapear de verdad                  | Simulador local de Yallegó (`tools/yallego-simulador`) |
| Y6  | No hay forma de consultar los alcances de una clave                                         | `transactions:write` solo se comprueba al primer cobro         | Aviso al dueño si el primer `confirm` da `403`     |
| Y7  | El webhook no acepta `localhost` ni redes privadas                                          | En desarrollo no llegan webhooks reales                       | Túnel o simulador                                  |
| Y8  | El MVP de Yallegó solo soporta Yape; Plin y BIM llegan en su v0.2                           | El restaurante cobra solo Yape y efectivo en el lanzamiento    | Las billeteras se muestran según lo que Yallegó soporte |

### 4.4. Lo que Yallegó podría agregar

**Cobros esperados** (`POST /v1/payment-intents`): el restaurante registra «espero
S/ 25.00 para el pedido 42» y Yallegó le avisa cuando llega ese pago. Es la caja
«servicio expuesto · validar pagos» del tablero y le serviría a cualquier sistema
de caja. Queda para después del MVP.

---

## 5. Mercado objetivo

### 5.1. Segmentos

| Segmento                                   | Por qué encaja                                      |
| ------------------------------------------ | --------------------------------------------------- |
| Pollerías y broasterías                    | Alto volumen, cobro en mostrador, mucho Yape        |
| Comida rápida, sangucherías, hamburgueserías | Cobran primero; pantalla de «pedido listo» habitual |
| Cevicherías y menús de mediodía            | Picos cortos e intensos; la cola es el problema     |
| Juguerías y cafeterías                     | Pedidos chicos, muchos Yape de monto bajo           |
| Cadenas pequeñas (2 a 10 locales)          | Necesitan ver ventas consolidadas                   |

**Fuera del objetivo inicial:** restaurantes con servicio a la mesa que cobran al
final (cuenta abierta). Requieren otro flujo.

### 5.2. Estimación de mercado

Pendiente. Se completará con datos del primer restaurante y de la base de clientes
de Yallegó.

---

## 6. Modelo de negocio

**Hipótesis, pendiente de validar con el primer restaurante.**

- Suscripción mensual **por local**.
- El restaurante necesita además una cuenta de Yallegó con acceso a la API (plan
  Negocio o superior).
- Pendiente decidir si la cuenta de Yallegó se incluye en el precio (venta conjunta)
  o el restaurante la contrata aparte. En el MVP cada restaurante conecta su propia
  cuenta.
- Alta asistida en el MVP: nosotros creamos el negocio y acompañamos la
  configuración. El registro autoservicio queda para después.

---

## 7. Restricciones y decisiones fundamentales

### 7.1. Decisiones tomadas el 2026-10-11

| #   | Decisión                                                                                        |
| --- | ----------------------------------------------------------------------------------------------- |
| D1  | Producto **multi-tenant**: un negocio tiene uno o más locales                                    |
| D2  | **Siempre se cobra antes de cocina**, sea para llevar o para comer en el local                   |
| D3  | Métodos de pago: **billeteras digitales vía Yallegó y efectivo**. No se acepta tarjeta           |
| D4  | **La caja trabaja solo desde un celular**                                                        |
| D5  | El celular de cobros debe estar activo siempre. Si falla, el sistema **avisa con la causa**      |
| D6  | Con el celular de cobros caído, la cajera **puede validar mirando la constancia** del cliente (monto y hora). Es una contingencia: queda registrada y se concilia después |
| D7  | Dos pantallas fijas: **cocina** y **pantalla pública** para clientes                             |
| D8  | Marca «entregado» **la cajera** en pedidos para llevar y **la mesera** en pedidos para comer en el local. Se agrega el rol MESERO |
| D9  | Los **combos son combinaciones fijas de platos** (un mixto). No tienen opciones a elegir; las bebidas se piden aparte |
| D10 | `resto` es el nombre de trabajo en el código hasta definir el nombre comercial                   |

### 7.2. Restricciones heredadas de Yallegó

| Restricción                                             | Consecuencia                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| El celular de cobros debe ser Android                   | Si el dueño usa iPhone, necesita un Android dedicado                |
| La app de Yallegó debe estar abierta y con permisos     | Se avisa en caja cuando deja de reportar                            |
| Yallegó no recupera cobros ocurridos con la app detenida | Un pago manual puede quedar sin respaldo aunque sea real            |
| La clave de API no puede salir del servidor             | Este sistema necesita backend propio                                |

### 7.3. Componentes del sistema (MVP)

| Componente          | Dispositivo                           | Usuario                       |
| ------------------- | ------------------------------------- | ----------------------------- |
| Caja                | Celular (app web instalable)          | Cajera                        |
| Salón               | Celular (misma app web)               | Mesera                        |
| Cocina              | Tablet o monitor táctil               | Pantalla vinculada, sin usuario |
| Pantalla pública    | TV o monitor                          | Pantalla vinculada, sin usuario |
| Panel de administración | Navegador de escritorio           | Dueño y administrador         |
| Backend             | Servidor                              | —                             |
| Celular de cobros   | Android con la app de Yallegó         | Ninguno (es de Yallegó)       |

Se recomienda que el celular de cobros sea **distinto** del celular de caja: si
comparten equipo, una falla de internet tumba ambos a la vez.

---

## 8. Riesgos y mitigaciones

### 8.1. Técnicos

| Riesgo                                                        | Probabilidad | Impacto | Mitigación                                                                        |
| ------------------------------------------------------------- | ------------ | ------- | --------------------------------------------------------------------------------- |
| Dos pedidos con el mismo monto y un solo Yape                 | Alta         | Alto    | La cajera siempre elige; aviso de ambigüedad; código de seguridad visible         |
| El celular de cobros pierde internet en hora punta            | Media        | Alto    | Aviso en caja, validación manual con constancia y conciliación posterior          |
| Yallegó no está disponible                                    | Baja         | Alto    | Cobro en efectivo y validación manual siguen funcionando                          |
| Internet inestable en el local                                | Media        | Alto    | Reintentos idempotentes; aviso de «sin conexión» en caja                          |
| Navegadores de TV lentos o desactualizados                    | Media        | Medio   | Pantalla pública liviana; se recomienda un dispositivo Android TV o mini PC       |
| Un mismo cobro confirmado dos veces en Yallegó (brecha Y1)    | Baja         | Alto    | Restricción única local                                                           |

### 8.2. Fraude

| Riesgo                                                       | Mitigación                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Constancia falsa aceptada en validación manual               | La validación manual solo se habilita con el celular caído; se concilia después y los pagos sin respaldo alertan al dueño |
| La cajera valida a mano sin que el celular esté caído        | El sistema bloquea la opción mientras el celular esté activo                   |
| La cajera usa el Yape de un cliente en otro pedido           | Cada cobro se usa una sola vez y queda ligado a quién lo confirmó              |

### 8.3. Legales y comerciales

| Riesgo                                                          | Mitigación                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------- |
| El nombre del pagador es dato personal (Ley 29733)              | Cifrado en reposo; nunca en la pantalla pública; retención limitada  |
| El restaurante necesita emitir boletas electrónicas             | Fuera del MVP; integración con un proveedor de facturación en v0.2   |
| El personal no adopta el sistema en hora punta                  | Piloto acompañado; flujo de cobro en tres toques                     |

---

## 9. Métricas de éxito

### 9.1. Piloto (primer restaurante, primer mes)

| Métrica                                                       | Objetivo   |
| ------------------------------------------------------------- | ---------- |
| Pedidos con pago verificado por Yallegó, del total con Yape   | ≥ 95 %     |
| Tiempo de cobro con Yape (pedido creado → enviado a cocina)   | < 60 s p50 |
| Pagos manuales sin respaldo al cierre del día                 | 0          |
| Pedidos duplicados o cobros usados dos veces                  | 0          |
| Diferencia de caja promedio por turno                         | < S/ 5     |

### 9.2. Producto (primer año)

| Métrica                             | Objetivo                 |
| ----------------------------------- | ------------------------ |
| Locales activos                     | Por definir con negocio  |
| Retención mensual de locales        | ≥ 90 %                   |
| Disponibilidad en horario de atención | ≥ 99.5 %               |

---

## 10. Roadmap general

### MVP (v0.1) — 8 sprints

Caja móvil, carta, pedidos, cobro con Yape vía Yallegó y efectivo, cocina,
vista de salón para la mesera, pantalla pública, avisos del celular de cobros, validación manual con
conciliación, turnos y cierre de caja, reportes básicos, multi-local.

### v0.2

Boletas y facturas electrónicas, impresión de tickets, estaciones de cocina,
Plin y otras billeteras (cuando Yallegó las soporte), registro autoservicio,
facturación automática de la suscripción.

### v1.0

Cobros esperados en Yallegó, carta con QR para que el cliente pida solo,
reportes consolidados de cadena, integraciones con delivery.

---

## 11. Decisiones pendientes

Resueltas el 2026-10-11: P2 (quién entrega, ver D8) y P3 (combos, ver D9). El
nombre de trabajo `resto` quedó aprobado para el código (D10).

| #   | Pregunta                                                                                                                                                         | Valor por defecto mientras no se decida                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| P1  | Nombre comercial del producto                                                                                                                                    | `resto` en el código                                                                 |
| P4  | ¿Se emiten boletas o facturas electrónicas (SUNAT) desde el sistema?                                                                                             | No en el MVP                                                                         |
| P5  | Hoy la cajera entrega una boleta simple firmada que el cliente devuelve al recoger. ¿Se sigue imprimiendo (con una impresora térmica pequeña junto al celular de caja) o se reemplaza por el número en pantalla? | Pendiente. Mientras tanto, la caja muestra número, detalle, total y tiempo estimado |
| P6  | ¿La cuenta de Yallegó va incluida en nuestro precio?                                                                                                             | No; cada restaurante conecta su cuenta                                               |
| P7  | Precios de los planes                                                                                                                                            | Por definir                                                                          |
| P8  | ¿En qué fecha será la reunión para mostrarle el sistema al restaurante? Sirve para ordenar los sprints y llegar con la demo lista                                 | Demo con simulador al cierre del Sprint 5                                            |
| P9  | ¿Qué equipos tiene o comprará el restaurante: celular dedicado para cobros, celular de caja, celular de la mesera, tablet de cocina y TV para clientes?          | Tablet Android de 10" y TV con Android TV                                            |
| P10 | Cuando el celular de cobros está caído y la cajera valida mirando la constancia del cliente, ¿se agrega un control extra? (a) un monto máximo, por ejemplo S/ 100; (b) que el administrador lo apruebe con un PIN; (c) ninguno: queda registrado y se revisa después | (c) Ninguno extra                                                                    |
| P11 | En pedidos para comer en el local, ¿cómo sabe la mesera a qué mesa llevar los platos? ¿El cliente ya tiene mesa al pedir, recibe un número para su mesa, o la mesera lo llama? | La cajera anota la mesa si el cliente ya la tiene; si no, la mesera lo ubica por número y nombre |
