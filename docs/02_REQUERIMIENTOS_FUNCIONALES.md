# 02 — Requerimientos Funcionales

> **Convención de IDs:** `RF-[MÓDULO]-[NNN]`
> **Prioridad:** `MUST` (MVP obligatorio) · `SHOULD` (MVP deseable) · `COULD` (v0.2+)
> Los requerimientos que dependen de una decisión pendiente indican la decisión
> (`P#`, ver `01_CONTEXTO_Y_ANALISIS.md` §11) y usan su valor por defecto.

---

## Índice de módulos

| Código | Módulo                                  |
| ------ | --------------------------------------- |
| `AUTH` | Autenticación                           |
| `TEN`  | Negocios y locales                      |
| `USR`  | Usuarios y roles                        |
| `PAN`  | Pantallas vinculadas                    |
| `CAR`  | Carta                                   |
| `MES`  | Zonas y mesas                           |
| `PED`  | Pedidos                                 |
| `PAG`  | Pagos                                   |
| `YLG`  | Integración con Yallegó                 |
| `COB`  | Celular de cobros                       |
| `COC`  | Pantalla de cocina                      |
| `PUB`  | Pantalla pública                        |
| `SAL`  | Salón (meseras)                         |
| `CAJ`  | Turnos y cierre de caja                 |
| `REP`  | Reportes                                |
| `AUD`  | Auditoría                               |
| `PLT`  | Administración de plataforma            |

---

## 1. AUTH — Autenticación

| ID          | Requerimiento                                                                                                  | Prioridad |
| ----------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| RF-AUTH-001 | El sistema permite iniciar sesión con correo y contraseña, y devuelve un access token y un refresh token.      | MUST      |
| RF-AUTH-002 | El sistema rota el refresh token en cada renovación e invalida toda la familia si detecta reutilización.       | MUST      |
| RF-AUTH-003 | El sistema permite cerrar sesión, invalidando el refresh token activo.                                         | MUST      |
| RF-AUTH-004 | El sistema permite recuperar la contraseña con un enlace por correo que vence a los 60 minutos.                | MUST      |
| RF-AUTH-005 | El sistema bloquea la cuenta 15 minutos tras 5 intentos fallidos consecutivos.                                 | MUST      |
| RF-AUTH-006 | Un usuario invitado activa su cuenta con un enlace por correo y define su contraseña.                          | MUST      |
| RF-AUTH-007 | La sesión en el celular de caja dura al menos 12 horas sin pedir la contraseña de nuevo.                       | MUST      |
| RF-AUTH-008 | La caja puede bloquearse y desbloquearse con un PIN de 4 a 6 dígitos sin cerrar la sesión.                     | COULD     |

---

## 2. TEN — Negocios y locales

| ID         | Requerimiento                                                                                                                                          | Prioridad |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| RF-TEN-001 | La plataforma da de alta un negocio con nombre comercial, RUC opcional y zona horaria (por defecto `America/Lima`), e invita a su primer dueño.        | MUST      |
| RF-TEN-002 | Un negocio tiene uno o más locales, cada uno con nombre, dirección y estado (activo o inactivo).                                                        | MUST      |
| RF-TEN-003 | Cada local tiene su configuración: ventana de pagos recientes (15 min), validación manual permitida, monto máximo manual, umbrales de demora en cocina y minutos para ocultar pedidos listos. | MUST      |
| RF-TEN-004 | Los datos de un negocio son invisibles para cualquier otro, a nivel de aplicación y de base de datos.                                                   | MUST      |
| RF-TEN-005 | El negocio puede subir su logo y elegir un color de acento para la pantalla pública.                                                                    | SHOULD    |
| RF-TEN-006 | La plataforma puede suspender un negocio: se bloquean nuevas operaciones y se conservan los datos.                                                       | SHOULD    |
| RF-TEN-007 | Un dueño puede registrar su negocio por su cuenta, sin alta asistida.                                                                                   | COULD     |
| RF-TEN-008 | El dueño puede exportar todos los datos del negocio.                                                                                                   | COULD     |

---

## 3. USR — Usuarios y roles

### 3.1. Matriz de roles

| Acción                                           | OWNER | ADMIN | CAJERO | MESERO | Pantalla de cocina | Pantalla pública |
| ------------------------------------------------ | :---: | :---: | :----: | :----: | :----------------: | :--------------: |
| Conectar Yallegó y asignar celulares a locales   | ✅    | —     | —      | —      | —                  | —                |
| Gestionar suscripción                            | ✅    | —     | —      | —      | —                  | —                |
| Gestionar dueños                                 | ✅    | —     | —      | —      | —                  | —                |
| Gestionar admins, cajeros y meseros              | ✅    | ✅    | —      | —      | —                  | —                |
| Gestionar locales, carta, mesas y pantallas      | ✅    | ✅    | —      | —      | —                  | —                |
| Ver reportes y auditoría                         | ✅    | ✅    | —      | —      | —                  | —                |
| Validar el cierre del día                        | ✅    | ✅    | —      | —      | —                  | —                |
| Abrir y cerrar su turno de caja                  | ✅    | ✅    | ✅     | —      | —                  | —                |
| Tomar pedidos y cobrar                           | ✅    | ✅    | ✅     | —      | —                  | —                |
| Validar un pago con constancia                   | ✅    | ✅    | ✅ *   | —      | —                  | —                |
| Cancelar un pedido por pagar                     | ✅    | ✅    | ✅     | —      | —                  | —                |
| Cancelar un pedido ya pagado                     | ✅    | ✅    | ✅ **  | —      | —                  | —                |
| Marcar entregado un pedido para llevar           | ✅    | ✅    | ✅     | —      | —                  | —                |
| Marcar entregado un pedido para comer en el local | ✅   | ✅    | ✅     | ✅     | ✅                 | —                |
| Indicar o corregir la mesa de un pedido          | ✅    | ✅    | ✅     | ✅     | —                  | —                |
| Marcar agotado un producto                       | ✅    | ✅    | ✅     | —      | —                  | —                |
| Pasar un pedido a preparación o listo            | —     | —     | —      | —      | ✅                 | —                |
| Ver pedidos en curso (sin montos)                | —     | —     | —      | ✅     | ✅                 | ✅               |

\* Solo mientras el celular de cobros del local no esté activo (RF-PAG-013).
\*\* Con motivo y devolución obligatorios; lo revisa el administrador al validar el cierre (P14).

Correspondencia con el tablero: `admin` → OWNER y ADMIN, `cajita` → CAJERO,
`cocina` → pantalla de cocina, `vpublic` → pantalla pública. La mesera del flujo
actual (D8) → MESERO. Las pantallas son dispositivos vinculados, no usuarios (ver
`07_SEGURIDAD_AUTH.md` §3).

### 3.2. Requerimientos

| ID         | Requerimiento                                                                                       | Prioridad |
| ---------- | --------------------------------------------------------------------------------------------------- | --------- |
| RF-USR-001 | OWNER y ADMIN invitan usuarios por correo con un rol.                                               | MUST      |
| RF-USR-002 | Un cajero o un mesero se asigna a uno o más locales y solo opera en esos locales.                    | MUST      |
| RF-USR-003 | OWNER y ADMIN cambian el rol de un usuario o lo desactivan; desactivarlo cierra sus sesiones.        | MUST      |
| RF-USR-004 | Un negocio siempre tiene al menos un OWNER activo.                                                  | MUST      |
| RF-USR-005 | Un usuario puede pertenecer a varios negocios y elegir con cuál trabajar.                           | SHOULD    |

---

## 4. PAN — Pantallas vinculadas

| ID         | Requerimiento                                                                                                | Prioridad |
| ---------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| RF-PAN-001 | OWNER o ADMIN genera un código de vinculación de 8 caracteres, válido 10 minutos, para una pantalla de cocina o pública de un local. | MUST      |
| RF-PAN-002 | La pantalla se vincula ingresando el código o escaneando un QR y queda autenticada sin usuario.              | MUST      |
| RF-PAN-003 | La pantalla recupera su sesión sola tras un corte de luz, un reinicio o una pérdida de internet.             | MUST      |
| RF-PAN-004 | OWNER o ADMIN ve las pantallas de cada local con su última conexión y puede revocarlas.                      | MUST      |
| RF-PAN-005 | Un local puede tener varias pantallas de cada tipo, todas sincronizadas.                                     | SHOULD    |

---

## 5. CAR — Carta

| ID         | Requerimiento                                                                                                                      | Prioridad |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RF-CAR-001 | OWNER o ADMIN crea, edita, ordena y desactiva categorías (platos, bebidas, combos).                                                 | MUST      |
| RF-CAR-002 | OWNER o ADMIN crea, edita y desactiva productos con nombre, descripción, precio, foto, categoría y si requiere preparación en cocina. | MUST      |
| RF-CAR-003 | Un combo es una combinación fija de platos (un mixto) con precio propio. Sus platos se muestran en cocina. (D9)                       | MUST      |
| RF-CAR-004 | Un producto puede tener grupos de opciones a elegir con mínimo, máximo y precio extra. El piloto no lo necesita: sus combos son fijos. | COULD     |
| RF-CAR-005 | Cada ítem de un pedido admite una nota libre («sin cebolla»).                                                                       | MUST      |
| RF-CAR-006 | Cada producto se habilita o deshabilita por local.                                                                                  | MUST      |
| RF-CAR-007 | La cajera marca un producto como agotado en su local desde el celular, y lo vuelve a habilitar.                                      | SHOULD    |
| RF-CAR-008 | El precio, nombre y platos de cada ítem se copian al pedido al crearlo; cambios posteriores en la carta no lo alteran.             | MUST      |
| RF-CAR-009 | Un producto puede tener un precio distinto en un local.                                                                             | COULD     |
| RF-CAR-010 | La carta se puede importar desde una hoja de cálculo.                                                                               | COULD     |

---

## 6. MES — Zonas y mesas

| ID         | Requerimiento                                                                                         | Prioridad |
| ---------- | ----------------------------------------------------------------------------------------------------- | --------- |
| RF-MES-001 | OWNER o ADMIN crea, edita y desactiva zonas de un local con su piso (patio de comida, primer piso; terraza, segundo piso). | MUST      |
| RF-MES-002 | OWNER o ADMIN crea, edita y desactiva mesas dentro de una zona, con número y capacidad.               | MUST      |
| RF-MES-003 | En un pedido para comer en el local, la cajera indica la zona donde se sentará el cliente y su nombre, ambos obligatorios. La mesa es opcional (P13). | MUST      |
| RF-MES-004 | La caja muestra qué mesas tienen pedidos en curso.                                                     | COULD     |

---

## 7. PED — Pedidos

| ID         | Requerimiento                                                                                                                                       | Prioridad |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RF-PED-001 | La cajera crea un pedido desde el celular con tipo (para comer aquí o para llevar), ítems, notas y nombre del cliente; para comer aquí, además zona y mesa opcional. | MUST      |
| RF-PED-002 | Crear un pedido requiere que la cajera tenga un turno de caja abierto en ese local.                                                                  | MUST      |
| RF-PED-003 | Cada pedido recibe un número correlativo diario por local (#0001), sin duplicados aunque dos cajas creen pedidos al mismo tiempo.                   | MUST      |
| RF-PED-004 | Reenviar la misma solicitud de creación (por mala señal o doble toque) no crea un segundo pedido.                                                    | MUST      |
| RF-PED-005 | Estados: `POR_PAGAR` → `EN_ESPERA` → `EN_PREPARACION` → `LISTO` → `ENTREGADO`, y `CANCELADO` desde `POR_PAGAR`, `EN_ESPERA` o `EN_PREPARACION`.     | MUST      |
| RF-PED-006 | Un pedido pasa a `EN_ESPERA` (y aparece en cocina) solo cuando la suma de sus pagos confirmados cubre el total.                                      | MUST      |
| RF-PED-007 | Un pedido sin ítems que requieran cocina pasa directo a `LISTO` al pagarse.                                                                          | SHOULD    |
| RF-PED-008 | Mientras está `POR_PAGAR`, la cajera puede editar ítems, tipo, mesa y nombre.                                                                        | MUST      |
| RF-PED-009 | La cajera cancela un pedido `POR_PAGAR` sin pagos confirmados.                                                                                       | MUST      |
| RF-PED-010 | La cajera, OWNER o ADMIN cancela un pedido pagado indicando motivo y cómo se devolvió el dinero (efectivo, Yape devuelto, no se devolvió). La cancelación aparece en la validación del cierre. (P14) | MUST      |
| RF-PED-011 | La cajera marca `ENTREGADO` los pedidos para llevar y la mesera los pedidos para comer en el local (D8). OWNER, ADMIN y la cajera pueden marcar cualquiera. | MUST      |
| RF-PED-012 | La caja lista los pedidos del día del local por estado: por pagar, en cocina, listos y entregados.                                                   | MUST      |
| RF-PED-013 | Cada cambio de estado guarda quién lo hizo y cuándo.                                                                                                 | MUST      |
| RF-PED-014 | Al cubrirse el pago, la caja muestra número, detalle, total y tiempo estimado de espera, para comunicárselos al cliente. Imprimirlos en una boleta simple depende de P5. | MUST      |
| RF-PED-015 | El sistema sugiere el tiempo estimado de espera según los tiempos recientes de cocina del local; la cajera puede cambiarlo antes de cobrar. | SHOULD    |
| RF-PED-016 | La cajera encuentra un pedido por su número cuando el cliente vuelve con su boleta.                                                                  | MUST      |

---

## 8. PAG — Pagos

| ID         | Requerimiento                                                                                                                                                         | Prioridad |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RF-PAG-001 | Cobro en efectivo: la cajera ingresa el monto recibido y el sistema calcula el vuelto.                                                                                 | MUST      |
| RF-PAG-002 | Cobro con billetera: la caja muestra los pagos recibidos por el celular de cobros del local en la ventana configurada, no usados, con los que coinciden en monto primero. | MUST      |
| RF-PAG-003 | La lista incluye pagos recibidos antes de crear el pedido, dentro de la ventana.                                                                                       | MUST      |
| RF-PAG-004 | La lista se actualiza sola, sin recargar, cuando llega un pago nuevo.                                                                                                  | MUST      |
| RF-PAG-005 | Si hay un solo pago con el monto exacto y un solo pedido esperando ese monto, el pago aparece preseleccionado. Nunca se confirma sin que la cajera toque «Confirmar». | MUST      |
| RF-PAG-006 | Si otro pedido del local espera el mismo monto, la caja lo advierte.                                                                                                   | MUST      |
| RF-PAG-007 | Antes de confirmar, la caja muestra monto, billetera, nombre del pagador, hora y código de seguridad.                                                                  | MUST      |
| RF-PAG-008 | Un pago de Yallegó se aplica a un solo pedido; un segundo intento responde «Este pago ya fue usado».                                                                   | MUST      |
| RF-PAG-009 | Al confirmar, el sistema marca el cobro como `CONFIRMED` en Yallegó con la nota «Pedido #NNNN · Local».                                                               | MUST      |
| RF-PAG-010 | Si Yallegó no responde, el pago queda «Confirmando…», se reintenta solo y la cajera puede seguir atendiendo.                                                         | MUST      |
| RF-PAG-011 | Un pedido acepta varios pagos, de uno o más métodos (dos personas que yapean, o parte en efectivo y parte con Yape).                                                   | SHOULD    |
| RF-PAG-012 | Si el pago no coincide con el saldo, se muestra la diferencia. Si falta, el pedido queda con saldo pendiente; si sobra, se registra el excedente.                    | SHOULD    |
| RF-PAG-013 | La validación con constancia solo está disponible mientras el celular de cobros del local no esté activo o Yallegó no responda, y si el local la permite.             | MUST      |
| RF-PAG-014 | En la validación con constancia, la cajera registra monto, hora, nombre del pagador y número de operación o código de seguridad, y opcionalmente una observación («no hay servicio de notificaciones»). El sistema guarda además el estado del celular de cobros. (D11) | MUST      |
| RF-PAG-015 | Cuando el celular de cobros vuelve y llegan los pagos atrasados, el sistema concilia solo los pagos manuales con un cobro del mismo monto y hora cercana.            | MUST      |
| RF-PAG-016 | Un pago manual sin cobro que lo respalde tras 12 horas queda «Sin respaldo» y se avisa al dueño.                                                                      | MUST      |
| RF-PAG-017 | El local puede fijar un monto máximo por validación con constancia. Desactivado por decisión del negocio (D11).                           | COULD     |
| RF-PAG-018 | La validación con constancia puede exigir el PIN de un administrador. Desactivado por decisión del negocio (D11).                          | COULD     |
| RF-PAG-019 | La cajera puede adjuntar una foto de la constancia.                                                                                                                    | COULD     |

---

## 9. YLG — Integración con Yallegó

| ID         | Requerimiento                                                                                                                                       | Prioridad |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RF-YLG-001 | El OWNER conecta su cuenta de Yallegó pegando una clave de API. El sistema comprueba que la clave funcione y tenga los alcances necesarios.          | MUST      |
| RF-YLG-002 | Al conectar, el sistema registra su webhook en Yallegó y guarda el secreto cifrado. El OWNER no configura nada en Yallegó salvo crear la clave.     | MUST      |
| RF-YLG-003 | El OWNER asigna cada celular de cobros de Yallegó a un local.                                                                                       | MUST      |
| RF-YLG-004 | El OWNER puede probar la conexión y ver si el evento de prueba llegó.                                                                               | MUST      |
| RF-YLG-005 | El sistema acepta un webhook solo con firma válida y antigüedad de 5 minutos o menos, procesa cada evento una sola vez y responde en menos de 2 s. | MUST      |
| RF-YLG-006 | El sistema mantiene una copia local de los cobros, alimentada por webhooks y por una consulta de respaldo cada 10 s mientras haya turnos abiertos.  | MUST      |
| RF-YLG-007 | Si la clave deja de funcionar o le falta un alcance, el sistema avisa al OWNER y a la caja.                                                         | MUST      |
| RF-YLG-008 | El OWNER puede reemplazar la clave sin perder el historial.                                                                                         | SHOULD    |
| RF-YLG-009 | El OWNER puede desconectar Yallegó: se elimina el webhook y se borran las credenciales.                                                             | SHOULD    |
| RF-YLG-010 | La caja ofrece solo las billeteras que Yallegó soporta para el negocio (Yape en el lanzamiento).                                                    | MUST      |

---

## 10. COB — Celular de cobros

| ID         | Requerimiento                                                                                                                                                  | Prioridad |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RF-COB-001 | El sistema calcula el estado de cobros de cada local: Activo, Demorado, Desconectado, Sin servicio o Sin celular asignado (ver `04_ARQUITECTURA_SOFTWARE.md` §5.5). | MUST      |
| RF-COB-002 | El estado se obtiene consultando los celulares en Yallegó cada 30 s y, cuando Yallegó los emita, de los eventos `device.offline` y `device.online`.            | MUST      |
| RF-COB-003 | Si el estado no es Activo, la caja muestra un aviso fijo con la causa probable y qué revisar. No se puede cerrar mientras dure.                                | MUST      |
| RF-COB-004 | Al pasar a Demorado, Desconectado o Sin servicio, la caja suena y vibra. Al volver a Activo muestra «Cobros activos de nuevo».                                 | MUST      |
| RF-COB-005 | El panel de administración muestra el estado de cobros de cada local, y el dueño recibe un correo si un local pasa más de 5 minutos sin cobros activos.       | SHOULD    |
| RF-COB-006 | Cuando Yallegó exponga permisos y cola del celular, el aviso muestra la causa exacta («la app Yallegó perdió el permiso de notificaciones»).                    | SHOULD    |
| RF-COB-007 | El sistema guarda el historial de incidencias por local: inicio, fin, duración y pagos manuales durante la incidencia.                                         | SHOULD    |
| RF-COB-008 | Si el propio celular de caja pierde internet, la caja lo indica y bloquea las acciones que necesitan servidor.                                                | MUST      |
| RF-COB-009 | Aviso al dueño por WhatsApp o notificación push.                                                                                                              | COULD     |

---

## 11. COC — Pantalla de cocina

| ID         | Requerimiento                                                                                                                  | Prioridad |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- |
| RF-COC-001 | La pantalla muestra los pedidos `EN_ESPERA` y `EN_PREPARACION` del local, del más antiguo al más nuevo según la hora de pago.  | MUST      |
| RF-COC-002 | Cada tarjeta muestra número, tipo (aquí o llevar) con color propio, mesa, ítems con los platos de cada combo y notas, y el tiempo desde el pago. | MUST      |
| RF-COC-003 | La pantalla tiene los botones «Preparar» (`EN_ESPERA` → `EN_PREPARACION`) y «Listo» (`EN_PREPARACION` → `LISTO`).             | MUST      |
| RF-COC-004 | Un toque equivocado se puede deshacer durante 10 segundos.                                                                      | SHOULD    |
| RF-COC-005 | Suena un aviso cuando entra un pedido nuevo.                                                                                    | MUST      |
| RF-COC-006 | La tarjeta cambia de color cuando el pedido supera los umbrales de demora del local.                                            | SHOULD    |
| RF-COC-007 | Un pedido cancelado sale de la pantalla con un aviso visible de «Cancelado».                                                    | MUST      |
| RF-COC-008 | Los ítems que no requieren cocina (una gaseosa) no se muestran en la tarjeta.                                                   | SHOULD    |
| RF-COC-009 | Estaciones (bebidas, parrilla) que solo reciben sus productos.                                                                  | COULD     |
| RF-COC-010 | Los pedidos para comer en el local que pasan a `LISTO` quedan en una columna «Para mesa», agrupados por zona, con número, nombre y zona en grande. | MUST      |
| RF-COC-011 | La mesera toca «Entregado» en la pantalla de cocina cuando recoge los platos de un pedido para mesa.                            | MUST      |

---

## 12. PUB — Pantalla pública

| ID         | Requerimiento                                                                                                         | Prioridad |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| RF-PUB-001 | La pantalla muestra dos columnas: «En preparación» (`EN_ESPERA` y `EN_PREPARACION`) y «Listos» (`LISTO`).             | MUST      |
| RF-PUB-002 | Cada pedido muestra su número y el nombre que dio el cliente abreviado, o la mesa. Nunca montos ni datos del pagador. | MUST      |
| RF-PUB-003 | Cuando un pedido pasa a «Listos», se resalta unos segundos y suena un aviso.                                           | MUST      |
| RF-PUB-004 | Un pedido entregado sale de la pantalla. Un pedido listo sale solo tras los minutos configurados en el local.         | MUST      |
| RF-PUB-005 | La pantalla funciona sin teclado ni ratón, a pantalla completa y sin que el equipo se suspenda.                       | MUST      |
| RF-PUB-006 | La pantalla muestra el logo y el color de acento del negocio.                                                          | SHOULD    |
| RF-PUB-007 | La pantalla anuncia por voz «Pedido 42, listo».                                                                         | COULD     |

---

## 13. SAL — Salón (meseras)

Solo si la mesera tiene celular (P12). Sin celular, usa la pantalla de cocina
(RF-COC-010 y RF-COC-011).

| ID         | Requerimiento                                                                                                                        | Prioridad |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| RF-SAL-001 | La mesera ingresa desde su celular y ve los pedidos para comer en el local que están en cocina o listos, con número, mesa, nombre y platos. | SHOULD    |
| RF-SAL-002 | Cuando un pedido para comer en el local pasa a `LISTO`, el celular de la mesera vibra y el pedido aparece primero.                   | SHOULD    |
| RF-SAL-003 | La mesera marca el pedido como `ENTREGADO` al dejarlo en la mesa.                                                                     | SHOULD    |
| RF-SAL-004 | La mesera puede indicar o corregir la mesa del pedido. (P13)                                                                          | SHOULD    |
| RF-SAL-005 | La mesera no ve montos ni pagos.                                                                                                      | SHOULD    |

---

## 14. CAJ — Turnos y cierre de caja

| ID         | Requerimiento                                                                                                                          | Prioridad |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RF-CAJ-001 | La cajera abre un turno en un local indicando el fondo inicial en efectivo.                                                            | MUST      |
| RF-CAJ-002 | Un usuario tiene como máximo un turno abierto a la vez.                                                                                 | MUST      |
| RF-CAJ-003 | La cajera registra ingresos y egresos de efectivo con motivo (compra de hielo, cambio de sencillo).                                      | SHOULD    |
| RF-CAJ-004 | Al cerrar, la cajera ingresa el efectivo contado. El sistema muestra el esperado, la diferencia y los totales por método de pago.       | MUST      |
| RF-CAJ-005 | No se puede cerrar un turno con pedidos por pagar o con pagos «Confirmando…».                                                          | MUST      |
| RF-CAJ-006 | OWNER y ADMIN ven los turnos de cada local con su detalle y diferencias.                                                                | MUST      |
| RF-CAJ-007 | OWNER y ADMIN pueden cerrar el turno de otro usuario (la cajera se fue sin cerrar).                                                     | SHOULD    |
| RF-CAJ-008 | Al final del día, OWNER o ADMIN valida el cierre de cada turno: diferencia de efectivo, pagos con constancia y su conciliación, y cancelaciones de pedidos pagados. Puede marcarlo validado u observado con un comentario. (D14) | MUST      |
| RF-CAJ-009 | La validación del cierre del día se puede hacer completa desde el celular del administrador.                                            | MUST      |

---

## 15. REP — Reportes

| ID         | Requerimiento                                                                                    | Prioridad |
| ---------- | ------------------------------------------------------------------------------------------------ | --------- |
| RF-REP-001 | Ventas por día y local, separadas en efectivo, billetera verificada y billetera manual.          | MUST      |
| RF-REP-002 | Pagos manuales con su estado de conciliación (pendiente, conciliado, sin respaldo).              | MUST      |
| RF-REP-003 | Ventas por producto y por categoría.                                                             | SHOULD    |
| RF-REP-004 | Tiempos de cocina: pago → listo, por día y franja horaria.                                       | SHOULD    |
| RF-REP-005 | Incidencias del celular de cobros por local.                                                     | SHOULD    |
| RF-REP-006 | Exportación a CSV de cada reporte.                                                               | SHOULD    |
| RF-REP-007 | Vista consolidada de todos los locales del negocio.                                              | SHOULD    |

---

## 16. AUD — Auditoría

| ID         | Requerimiento                                                                                                                                                       | Prioridad |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RF-AUD-001 | El sistema registra: validaciones con constancia, cancelaciones de pedidos pagados, cierres de turno con diferencia, cambios de precio, conexión con Yallegó, gestión de usuarios y pantallas. | MUST      |
| RF-AUD-002 | OWNER y ADMIN consultan la auditoría filtrando por fecha, acción, usuario y local.                                                                                   | MUST      |
| RF-AUD-003 | Los registros de auditoría no se pueden modificar ni borrar desde la aplicación.                                                                                     | MUST      |

---

## 17. PLT — Administración de plataforma

| ID         | Requerimiento                                                                                         | Prioridad |
| ---------- | ----------------------------------------------------------------------------------------------------- | --------- |
| RF-PLT-001 | Un administrador de plataforma da de alta negocios e invita a su primer OWNER.                        | MUST      |
| RF-PLT-002 | La consola muestra, por negocio, el estado de la conexión con Yallegó y de sus celulares de cobros.   | SHOULD    |
| RF-PLT-003 | Un administrador de plataforma suspende o reactiva negocios.                                          | SHOULD    |
| RF-PLT-004 | La plataforma registra el plan de cada negocio y activa pagos de suscripción a mano.                  | SHOULD    |
| RF-PLT-005 | Soporte puede ver un negocio en modo solo lectura, con registro en auditoría.                         | COULD     |

---

## 18. Trazabilidad: requerimientos por sprint

| Sprint | Módulos y requerimientos principales                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| 1      | AUTH-001…007, TEN-001…004, USR-001…004, PLT-001, AUD-001 (base)                          |
| 2      | CAR-001…008, MES-001…003, TEN-005                                                        |
| 3      | PED-001…006, PED-008, PED-009, PED-012…015, PAG-001, CAJ-001, CAJ-002, COB-008         |
| 4      | YLG-001…007, YLG-010, PAG-002…010                                                        |
| 5      | PAN-001…005, COC-001…011, PUB-001…006, SAL-001…005, PED-007, PED-011, PED-016            |
| 6      | COB-001…007, PAG-013…017                                                                 |
| 7      | CAJ-003…009, PED-010, PAG-011, PAG-012, REP-001…007, AUD-001…003, YLG-008, YLG-009       |
| 8      | PLT-002…004, TEN-006, endurecimiento y piloto                                            |
