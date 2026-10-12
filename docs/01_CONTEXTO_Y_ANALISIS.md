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
5. **Para comer en el local:** el cliente se sienta en el patio de comida (primer
   piso) o en la terraza (segundo piso). Cuando los platos salen de cocina, una
   **mesera** los recoge, va a la zona y llama al cliente por su nombre
   («¿Carlos?»). El cliente levanta la mano y recibe su pedido.

Todo pedido, sea para llevar o para comer en el local, se hace en la caja. Si el
cliente reclama porque su pedido no es el que pidió (la cajera lo registró mal), la
mesera lo comenta con la cajera y ella decide si se corrige o se cancela.

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
| Cocina     | Los pedidos pagados en orden, con su tiempo y tipo, en un celular o una pantalla |
| Mesera     | Ve en cocina qué pedidos de mesa están listos, con el nombre y la zona para llamar al cliente |
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
| D7  | **Pantalla pública** afuera, para los clientes. En cocina, un **celular** en el MVP y una pantalla táctil como propuesta al comercio (D17) |
| D8  | Marca «entregado» **la cajera** en pedidos para llevar y **la mesera** en pedidos para comer en el local. Se agrega el rol MESERO |
| D9  | Los **combos son combinaciones fijas de platos** (un mixto). No tienen opciones a elegir; las bebidas se piden aparte |
| D10 | `resto` es el nombre de trabajo en el código hasta definir el nombre comercial                   |
| D11 | Validación con constancia **sin control extra** (ni monto máximo ni PIN): queda registrada con una **observación opcional** («no hay servicio de notificaciones») y el estado del celular de cobros, y se concilia después |
| D12 | Para comer en el local, la cajera pregunta y registra **nombre** (el que el cliente quiera dar) y **zona**: patio de comida (primer piso) o terraza (segundo piso). **No se usan números de mesa**: al pedir, el cliente aún no sabe dónde se sentará. La mesera lo llama por su nombre |
| D13 | Equipos del local: celular de cobros con Yallegó, celular de la cajera, celular de la mesera, celular de cocina y pantalla pública afuera (§7.4) |
| D14 | El administrador **no está todo el día**: valida el cierre de caja al final de la jornada, desde su celular o computadora |
| D15 | La **mesera usa su celular**: ve los pedidos de mesa con nombre, zona y detalle, se los lleva y marca «Entregado» antes o después de entregar, como prefiera |
| D16 | Un pedido pagado solo se corrige o se cancela a partir de una **observación** (reclamo) que registra la mesera o la cajera. La cajera la resuelve y el administrador lo revisa al validar el cierre |
| D17 | **La cocina y la mesera marcan sus estados desde un celular.** Se propondrá al comercio una **pantalla táctil en cocina** donde ambas puedan marcarlos |
| D18 | En pedidos **para llevar se cobra el táper**, según los productos; en pedidos para comer en el local no se cobra |
| D19 | **Una sola caja** y un turno por la jornada completa                                             |
| D20 | Pantalla pública, opción B: todos los pedidos en «En preparación»; en «Listos», solo los de llevar. Los de mesa los lleva la mesera |
| D21 | El **costo del táper lo configura el administrador** por producto, con un valor por defecto del local |
| D22 | En una corrección, si el pedido correcto cuesta más, el cliente **paga la diferencia**; si cuesta menos, **se le devuelve**, normalmente en efectivo |
| D23 | La cocina tendrá, además del celular, un **TV o monitor no táctil** que muestra la cola de lejos, en solo lectura (recomendado) |
| D24 | **Descuentos, promociones y cortesías** los configura cada comercio                              |
| D25 | **La cajera no decide descuentos ni cortesías.** Todo lo configura el administrador: descuentos automáticos, descuentos «a elección» y cortesías definidas (por ejemplo, «canchita de cortesía para comer aquí»). No hay descuentos libres |
| D26 | Línea gráfica **Marino** (2026-10-12): Marino clásico (claro) en caja, salón y administración; Marino noche (oscuro) en cocina y pantalla pública. Mascota: campana con «ding». Cada restaurante pone su nombre y un color de acento, con el sello «con resto» (`09_DESIGN_SYSTEM.md`) |
| D27 | **La pantalla muestra el código; la administración lo aprueba** (2026-10-12). La TV, el monitor o el celular de cocina muestran un código y un QR; el administrador lo escanea con la cámara de su celular, elige local y tipo, y la pantalla entra sola. Nadie escribe con el control remoto (`07_SEGURIDAD_AUTH.md` §3.1) |

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
| Salón               | Celular de la mesera (app web)        | Mesera                        |
| Cocina              | Celular que marca y TV o monitor que muestra (propuesta: pantalla táctil) | Dispositivos vinculados, sin usuario |
| Pantalla pública    | TV o monitor                          | Pantalla vinculada, sin usuario |
| Panel de administración | Celular o computadora del administrador | Dueño y administrador, sobre todo al cierre del día |
| Backend             | Servidor                              | —                             |
| Celular de cobros   | Android con la app de Yallegó         | Ninguno (es de Yallegó)       |

Se recomienda que el celular de cobros sea **distinto** del celular de caja: si
comparten equipo, una falla de internet tumba ambos a la vez.

### 7.4. Equipos del local

**Confirmados con el restaurante piloto (2026-10-11):**

| Equipo                         | Dónde                          | Para qué                                                   | Requisitos                                                              |
| ------------------------------ | ------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Celular de cobros              | Caja, fijo                     | Recibe los Yape; tiene instalada la app de Yallegó         | Android dedicado, siempre enchufado, con datos móviles además de Wi-Fi |
| Celular de la cajera           | Caja                           | Tomar pedidos, cobrar y entregar los pedidos para llevar   | Android 10+ o iPhone con iOS 16.4+                                      |
| Celular de la mesera           | Salón (patio y terraza)        | Ver los pedidos de mesa y marcarlos entregados             | Android 10+ o iPhone con iOS 16.4+; puede ser su propio celular        |
| Celular de cocina              | Cocina                         | Ver la cola y marcar en preparación y listo                | Android o iPhone; vinculado como dispositivo de cocina, sin usuario     |
| TV o monitor de cocina         | Cocina, a la vista             | Ver la cola de lejos, en solo lectura (recomendado)        | TV o monitor con navegador, o con un TV box                             |
| Pantalla pública               | Afuera, visible a los clientes | Pedidos en preparación y listos                            | TV con Android TV o Google TV, o un dispositivo que la convierta        |
| Celular o computadora del administrador | Donde esté            | Validar el cierre del día                                  | Cualquiera con navegador; no es un equipo dedicado                     |

**Recomendados:**

| Equipo                                                  | Por qué                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Plan de datos móviles en el celular de cobros           | Si se cae el Wi-Fi, sigue recibiendo los Yape por 4G. Es lo que más protege el «activo al 100 %»      |
| Cargador fijo para el celular de cobros                 | Que no se apague por batería; además, la app de Yallegó va sin ahorro de batería                    |
| UPS pequeño (no-break) para el router                   | Ante un corte de luz, los celulares siguen conectados al Wi-Fi                                       |
| Pantalla táctil en cocina (tablet de 10" o más, o monitor táctil) | Propuesta: cocina y mesera marcan ahí sus estados, y la cola se ve de lejos             |
| Soporte de pared y funda para la pantalla de cocina     | Propuesta: a la altura de los ojos y lejos del calor, el vapor y la grasa                            |
| Dispositivo Android TV o Google TV (TV box o similar)   | Solo si la TV de afuera no es Smart o su navegador es antiguo                                        |
| TV bajo techo y con buen brillo                         | Afuera, el sol directo vuelve ilegible una TV común                                                  |
| Parlante para la pantalla pública                       | *En espera.* Si hay ruido de la calle, para que se escuche el aviso de «pedido listo»                |

**Por decidir:** impresora térmica para la boleta simple (P5, en espera).

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

Resueltas el 2026-10-11: P2 (D8), P3 (D9), P9 (D13), P10 (D11), P11 y P13 (D12),
P12 (D15), P14 (D16), P15 (D20), P16 (D18), P17 (D24), P18 (D19), P21 (D22), P22
(D23), P23 (D21) y P24 (D25). El nombre de trabajo `resto` quedó aprobado para el código (D10).

Sobre el volumen (P20): el piloto es muy concurrido, pero no hay cifras. Se diseña
para 120 pedidos por hora en punta (RNF-ESC-001) y el volumen real se mide en las
primeras semanas del piloto.

**En espera**, se retoman más adelante: P5 (boleta impresa),
carta completa del piloto, su cuenta de Yallegó, el parlante de la pantalla pública
y el soporte de la pantalla de cocina.

| #   | Pregunta                                                                                                                         | Valor por defecto mientras no se decida                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| P1  | Nombre comercial del producto                                                                                                    | `resto` en el código                                     |
| P4  | ¿Se emiten boletas o facturas electrónicas (SUNAT) desde el sistema?                                                             | No en el MVP                                             |
| P5  | *En espera.* ¿Se sigue imprimiendo la boleta simple o basta con el número en pantalla?                                          | La caja muestra número, detalle, total y tiempo estimado |
| P6  | ¿La cuenta de Yallegó va incluida en nuestro precio?                                                                             | No; cada restaurante conecta su cuenta                   |
| P7  | Precios de los planes                                                                                                            | Por definir                                              |
| P8  | ¿En qué fecha será la reunión para mostrarle el sistema al restaurante?                                                          | Demo con simulador al cierre del Sprint 5                |
| P19 | Pedidos por WhatsApp, teléfono o delivery: el negocio explicará el flujo si decide implementarlo                                 | Solo pedidos presenciales en caja                        |
