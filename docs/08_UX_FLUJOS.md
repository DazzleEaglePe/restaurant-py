# 08 — Flujos de Experiencia de Usuario

> Los flujos respetan los bocetos del tablero: navegación inferior «Inicio ·
> Pedidos», menú ☰ arriba a la derecha, lista «Últimos pagos» y detalle del pago con
> «Cancelar / Confirmar».

---

## 1. Actores del sistema

| Actor                | Dispositivo                       | Objetivo                                                   |
| -------------------- | --------------------------------- | ---------------------------------------------------------- |
| Cajera               | Celular                           | Atender rápido y no aceptar pagos falsos                   |
| Mesera               | Celular                           | Llevar a la mesa los pedidos listos y marcarlos entregados |
| Cocina               | Tablet o monitor táctil (pantalla vinculada) | Saber qué preparar y en qué orden                 |
| Cliente              | Pantalla pública (solo mira)      | Saber cuándo recoger su pedido                             |
| Administrador        | Escritorio                        | Mantener carta, mesas, usuarios y pantallas; ver reportes  |
| Dueño                | Escritorio o celular              | Todo lo del administrador, más Yallegó y suscripción      |
| Soporte de plataforma | Escritorio                       | Dar de alta negocios y ayudar en la puesta en marcha       |

---

## 2. Mapa de navegación

### 2.1. Caja (celular)

```
Ingresar ─► Elegir local* ─► Abrir turno** ─┬─► Inicio (carta) ──► Pedido en armado ──► Cobrar ─┬─► Yape: Últimos pagos ─► Detalle del pago
                                            │                                                  ├─► Efectivo
                                            │                                                  └─► Con constancia***
                                            ├─► Pedidos (por pagar · en cocina · listos · entregados)
                                            └─► ☰ Menú: Turno de caja · Agotados · Mi cuenta · Salir

  *   Solo si la cajera tiene más de un local.
  **  Solo si no tiene turno abierto.
  *** Solo con el celular de cobros caído.
```

Navegación inferior fija: **Inicio** · **Pedidos**. Sobre ella, el chip de estado
de cobros (§9) siempre visible.

### 2.2. Cocina

Una sola pantalla: tablero de pedidos. Sin menú; la configuración se hace desde
la administración.

### 2.3. Pantalla pública

Una sola pantalla: «En preparación» y «Listos». Sin interacción.

### 2.4. Administración

```
Inicio (hoy por local) ─┬─ Pedidos
                        ├─ Turnos de caja
                        ├─ Carta: categorías · productos · combos
                        ├─ Locales: datos · configuración · zonas y mesas · pantallas
                        ├─ Equipo
                        ├─ Cobros: estado · incidencias · constancias por conciliar
                        ├─ Reportes
                        ├─ Auditoría
                        └─ Configuración: negocio · Yallegó · suscripción
```

### 2.5. Salón (mesera)

Una sola lista, **Para mesas**, con dos segmentos: **Listos** (primero) y **En
cocina**. Cada pedido muestra número, mesa, nombre y platos, sin montos. El menú ☰
solo tiene Mi cuenta y Salir.

---

## 3. Flujo: puesta en marcha de un negocio

Alta asistida en el MVP. Lo acompaña soporte, idealmente en el local.

| Paso | Quién    | Acción                                                                 | Verificación visible                           |
| ---- | -------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| 1    | Soporte  | Da de alta el negocio e invita al dueño                                | Correo de invitación enviado                   |
| 2    | Dueño    | Activa su cuenta y define contraseña                                   | Entra a la administración                      |
| 3    | Dueño    | Crea sus locales                                                       | Lista de locales                               |
| 4    | Dueño    | En Yallegó: vincula el celular de cobros y crea una clave de API con los alcances indicados | Pantalla de ayuda con capturas de Yallegó |
| 5    | Dueño    | Pega la clave en Configuración → Yallegó                               | «Conectado» y lista de celulares               |
| 6    | Dueño    | Asigna cada celular a su local                                         | Estado de cobros del local en verde            |
| 7    | Dueño    | Prueba la conexión                                                     | «Evento de prueba recibido»                    |
| 8    | Admin    | Carga la carta (categorías, productos y combos)                        | Vista previa de la carta como la ve la caja    |
| 9    | Admin    | Crea zonas y mesas                                                     | Lista de mesas                                 |
| 10   | Admin    | Invita a cajeras y meseras y les asigna locales                              | Invitaciones enviadas                          |
| 11   | Admin    | Vincula la pantalla de cocina y la pública con su código               | Ambas «En línea»                               |
| 12   | Todos    | Prueba de punta a punta: un pedido de S/ 1.00 pagado con Yape real      | El pedido aparece en cocina y en la pantalla pública |

La administración muestra una lista de puesta en marcha con estos pasos y su
avance hasta completarlos.

---

## 4. Flujo: inicio del turno

1. La cajera ingresa con su correo y contraseña (una vez cada 12 h o más).
2. Si opera en varios locales, elige uno.
3. Si no tiene turno abierto: «Abrir turno» con el fondo inicial en efectivo.
4. Llega a **Inicio** con la carta. El chip de cobros muestra el estado del local.

---

## 5. Flujo: tomar un pedido

**Inicio (carta)**

```
┌──────────────────────────────┐
│ Centro          ● Cobros OK ☰│
│ [Ceviches][Combinados][+]    │
│ ┌──────────┐  ┌──────────┐   │
│ │  foto    │  │  foto    │   │
│ │ Ceviche  │  │ Mixto    │   │
│ │ S/ 25.00 │  │ S/ 32.00 │   │
│ └──────────┘  └──────────┘   │
│ ┌──────────┐  ┌──────────┐   │
│ │ Jalea    │  │ Chicha   │   │
│ │ S/ 38.00 │  │ Agotado  │   │
│ └──────────┘  └──────────┘   │
│ ┌──────────────────────────┐ │
│ │ Ver pedido · 5 · S/ 97.00│ │
│ └──────────────────────────┘ │
│   Inicio          Pedidos    │
└──────────────────────────────┘
```

1. Toca un producto: se agrega con cantidad 1. Un combo (un mixto) se agrega
   igual: sus platos son fijos.
2. Mantener presionado abre la hoja del ítem: cantidad y nota («sin ají»).
3. La barra «Ver pedido» muestra cantidad de ítems y total.

**Pedido en armado (resumen)**

1. Tipo: **Para comer aquí** (con mesa, opcional u obligatoria según el local) o
   **Para llevar**.
2. Nombre del cliente (sugerido para llevar; se muestra abreviado en la pantalla
   pública).
3. Ítems editables: cantidad, nota, quitar.
4. Botones: **Cancelar** y **Cobrar S/ 97.00**.

Al tocar **Cobrar**, el pedido se crea (`POR_PAGAR`, número asignado) y pasa a la
pantalla de cobro. Si un precio cambió mientras tanto, se muestra el total nuevo
antes de continuar. La pantalla de cobro muestra el tiempo de espera sugerido
(«~30 min»), que la cajera puede cambiar.

---

## 6. Flujo: cobrar con Yape

### 6.1. Últimos pagos

```
┌──────────────────────────────┐
│ ← Pedido #0042    ● Cobros OK│
│ Cobrar S/ 97.00               │
│ [ Yape ] [ Efectivo ]         │
│                               │
│ ⚠ El pedido #0041 también     │
│   espera S/ 97.00             │
│                               │
│ ÚLTIMOS PAGOS                 │
│ ┌──────────────────────────┐ │
│ │ Yape · S/ 97.00  ✓Coincide│ │
│ │ Victor A. Capitan N.      │ │
│ │ 18:30 · código 315        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Yape · S/ 97.00  ✓Coincide│ │
│ │ Lucía R. Quispe M.        │ │
│ │ 18:29 · código 802        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Yape · S/ 12.00           │ │
│ │ Jorge P. …   18:27 · 144  │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- Los pagos con el monto exacto van primero, con la etiqueta «Coincide».
- Un pago nuevo aparece arriba con una animación breve y una vibración corta.
- Si no hay pagos: «Esperando pago de S/ 97.00…» con un indicador animado.
- Pista para la cajera bajo el título: «Pide al cliente el código de 3 dígitos de
  su Yape».

### 6.2. Detalle del pago

```
┌──────────────────────────────┐
│ ← Detalle del pago            │
│                               │
│         S/ 97.00              │
│   Yape · hoy 18:30:58         │
│                               │
│   Victor A. Capitan N.        │
│                               │
│   Código de seguridad         │
│          3 1 5                │
│                               │
│   Pedido #0042 · S/ 97.00 ✓   │
│                               │
│ ┌───────────┐ ┌─────────────┐ │
│ │ Cancelar  │ │  Confirmar  │ │
│ └───────────┘ └─────────────┘ │
└──────────────────────────────┘
```

- Si el monto no coincide con el saldo, la línea del pedido lo dice:
  «Falta S/ 5.00» o «Sobra S/ 2.00».
- **Confirmar** → indicador en el botón → resultado.

### 6.3. Resultados

| Resultado                    | Pantalla                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Confirmado                   | Confirmación con el número **#0042** grande, el detalle, el total y «Listo en ~30 min» para decírselo al cliente; botón **Nuevo pedido** |
| Falta saldo                  | «Pago registrado. Falta S/ 5.00» y vuelve a «Últimos pagos»                                 |
| Confirmando (Yallegó lento)  | «Confirmando el pago…»; la cajera puede volver a Inicio. El resultado llega como aviso       |
| Ya usado                     | «Este pago ya se usó en el pedido #0039.» El pago desaparece de la lista                    |
| Sin permiso en Yallegó       | «No podemos confirmar pagos: la conexión con Yallegó falló. Avisa al administrador.»        |

---

## 7. Flujo: cobrar en efectivo

1. Pestaña **Efectivo**.
2. Atajos: «Exacto», S/ 50, S/ 100, S/ 200, y teclado numérico para otro monto.
3. El vuelto aparece grande: «Vuelto S/ 3.00».
4. **Confirmar** → «Pedido #0042 enviado a cocina».

### 7.1. Pagos divididos o mixtos

Si el pago cubre solo parte del total, el pedido queda con saldo y la pantalla de
cobro sigue abierta mostrando «Pagado S/ 50.00 · Falta S/ 47.00». Se puede seguir
con Yape o con efectivo. Recién al cubrir el total pasa a cocina.

---

## 8. Flujo: pedidos

Pestaña **Pedidos** con segmentos:

| Segmento     | Contenido                         | Acción principal                         |
| ------------ | --------------------------------- | ---------------------------------------- |
| Por pagar    | `POR_PAGAR`                       | Abrir para cobrar, editar o cancelar     |
| En cocina    | `EN_ESPERA` y `EN_PREPARACION`    | Ver detalle                              |
| Listos       | `LISTO`, con contador en la pestaña | **Entregar**                           |
| Entregados   | `ENTREGADO` y `CANCELADO` de hoy  | Ver detalle                              |

Cuando un pedido pasa a Listo, la caja vibra y la pestaña Pedidos muestra un punto.

---

## 9. Flujo: celular de cobros caído

### 9.1. Chip y avisos

El chip junto al nombre del local está siempre visible. Si el estado no es Activo,
aparece además un aviso fijo debajo del encabezado que no se puede cerrar.

| Estado          | Chip                  | Aviso                                                                                                    |
| --------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| Activo          | ● Cobros OK (verde)   | —                                                                                                        |
| Demorado        | ● Cobros demorados (ámbar) | **El celular de cobros no reporta hace 4 min.** Los Yape nuevos pueden tardar en aparecer. Revisa que tenga internet y que la app Yallegó esté abierta. |
| Desconectado    | ● Sin cobros (rojo)   | **El celular de cobros está desconectado desde las 18:02.** Revisa: que tenga internet, que esté encendido y con batería, que la app Yallegó esté abierta y con permiso de notificaciones. Mientras tanto puedes validar con la constancia del cliente. |
| Sin servicio    | ● Sin cobros (rojo)   | **No podemos comunicarnos con Yallegó.** Cobra en efectivo o valida con la constancia del cliente. Te avisaremos cuando vuelva. |
| Conexión inválida | ● Sin cobros (rojo) | **La conexión con Yallegó dejó de funcionar.** Avisa al administrador para que la revise.                 |
| Sin celular     | ● Sin celular (gris)  | **Este local no tiene celular de cobros asignado.** Solo puedes cobrar en efectivo.                       |
| Caja sin internet | ● Sin internet (gris) | **Este celular no tiene internet.** No se pueden registrar pedidos hasta que vuelva.                    |

- Al empeorar el estado: sonido de alerta y vibración larga.
- Al volver a Activo: aviso verde «Cobros activos de nuevo» durante 5 s.
- Cuando Yallegó informe la causa exacta (brecha Y3), el aviso dirá solo esa causa:
  «La app Yallegó perdió el permiso de notificaciones».

### 9.2. Validar con constancia

Visible en la pantalla de cobro solo en los estados Desconectado, Sin servicio o
Conexión inválida, y si el local lo permite.

1. Pestaña **Constancia** con el aviso: «Úsala solo si ves la constancia en el
   celular del cliente. Esta validación se revisará cuando vuelva el celular de cobros.»
2. Campos: billetera, monto (prellenado con el saldo), hora del pago (prellenada
   con la hora actual), nombre del pagador, y **número de operación o código de
   seguridad** (al menos uno).
3. **Confirmar** → el pedido pasa a cocina. El pago queda marcado «Con constancia»
   en la lista de pedidos.

### 9.3. Después de la caída

- Cuando el celular vuelve y llegan los pagos atrasados, el sistema concilia solo.
- La administración ve en **Cobros → Constancias por conciliar** las pendientes, las
  conciliadas y las que quedaron «Sin respaldo», con la opción de ligarlas a mano.
- El dueño recibe un correo con las que quedaron sin respaldo.

---

## 10. Flujo: cocina

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Cocina · Centro                                          18:44   ● En línea     │
├───────────────────┬───────────────────┬───────────────────┬─────────────────────┤
│ #0039  LLEVAR     │ #0040  AQUÍ · M5  │ #0041  LLEVAR     │ #0042  AQUÍ · M2    │
│ 12 min  (rojo)    │ 9 min   (ámbar)   │ 4 min             │ 1 min               │
│ 2 × Mixto         │ 1 × Jalea mixta   │ 1 × Ceviche       │ 2 × Mixto           │
│ 1 × Ceviche       │   sin cebolla     │   sin ají         │ 1 × Ceviche         │
│                   │                   │                   │   sin ají           │
│ EN PREPARACIÓN    │ EN PREPARACIÓN    │                   │                     │
│ ┌───────────────┐ │ ┌───────────────┐ │ ┌───────────────┐ │ ┌─────────────────┐ │
│ │     LISTO     │ │ │     LISTO     │ │ │   PREPARAR    │ │ │    PREPARAR     │ │
│ └───────────────┘ │ └───────────────┘ │ └───────────────┘ │ └─────────────────┘ │
└───────────────────┴───────────────────┴───────────────────┴─────────────────────┘
```

- Orden por hora de pago, de izquierda a derecha.
- **Para llevar** y **para comer aquí** se distinguen por color de la franja
  superior y por la etiqueta de texto.
- Todo pedido entra como pendiente; el botón cambia a **Listo** al pasar a preparación.
- Tras tocar, aparece «Deshacer» durante 10 s en la tarjeta.
- Pedido nuevo: sonido corto y la tarjeta entra con un destello.
- Pedido cancelado: la tarjeta muestra «CANCELADO» en rojo 5 s y sale.
- Muchos pedidos: las tarjetas se desplazan en horizontal; un contador arriba
  indica cuántos hay fuera de vista.

---

## 11. Flujo: pantalla pública

```
┌──────────────────────────────────────────────────────────────────┐
│  [logo]  Cevichería Demo                                  18:44  │
├────────────────────────────────┬─────────────────────────────────┤
│        EN PREPARACIÓN          │            LISTOS               │
│                                │                                 │
│   #0041  María G.              │   ██ #0039  Carlos ██            │
│   #0042  Mesa 2                │      #0038  Ana P.              │
│   #0043  Jorge                 │                                 │
└────────────────────────────────┴─────────────────────────────────┘
```

- Al pasar a Listo, el pedido entra a la columna derecha con un resaltado de 8 s
  y un sonido. Opcional: voz «Pedido 39, listo».
- Los pedidos entregados salen. Los listos salen solos tras los minutos
  configurados.
- Sin pedidos: logo del negocio y «Tus pedidos aparecerán aquí».
- Sin conexión: los datos se quedan en pantalla y aparece un punto gris discreto
  en la esquina; nunca una pantalla de error frente a los clientes.

---

## 12. Flujo: entrega

### 12.1. Para llevar (cajera)

1. La caja vibra: «#0039 está listo».
2. El cliente vuelve con su boleta o su número.
3. La cajera busca el número en **Pedidos → Listos** y toca **Entregar**.
4. El pedido sale de la pantalla pública.

### 12.2. Para comer en el local (mesera)

1. El celular de la mesera vibra: «#0040 · Mesa 5 está listo».
2. La mesera alista los platos y los lleva a la mesa.
3. En **Para mesas → Listos** toca **Entregado**. El pedido sale de la pantalla
   pública.

Si el pedido no tiene mesa, la mesera lo ubica por número y nombre, y puede anotar
la mesa al entregarlo (decisión pendiente P11). Si no hay mesera en el turno, la
cajera lo marca desde **Pedidos → Listos**.

---

## 13. Flujo: cancelar un pedido

| Situación                         | Quién            | Pasos                                                                              |
| --------------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| Por pagar, sin pagos              | Cajera           | Pedido → **Cancelar pedido** → motivo opcional                                    |
| Pagado, en cocina o en espera     | Admin o dueño    | Pedido → **Cancelar pedido** → motivo y devolución (efectivo, Yape devuelto, no se devolvió) |

Si la devolución es en efectivo, se registra como egreso del turno abierto de quien
cancela.

---

## 14. Flujo: cierre de turno

1. ☰ → **Turno de caja** muestra fondo, efectivo cobrado, egresos, Yape verificado
   y con constancia, y número de pedidos.
2. **Cerrar turno**. Si hay pedidos por pagar o pagos confirmándose, se listan y hay
   que resolverlos primero.
3. La cajera cuenta e ingresa el efectivo.
4. El sistema muestra esperado, contado y diferencia, con un color según el monto.
5. Confirma. El turno queda en el historial de la administración.

---

## 15. Estados de interfaz

| Estado                 | Tratamiento                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ |
| Cargando               | Esqueletos con la forma del contenido; nunca pantalla en blanco                |
| Error recuperable      | Mensaje en una línea con **Reintentar**                                        |
| Sin conexión (caja)    | Aviso fijo gris; botones de servidor deshabilitados; la carta sigue visible    |
| Sesión vencida         | Vuelve al ingreso conservando el pedido en armado                              |
| Producto agotado       | Tarjeta atenuada con «Agotado»; no se puede agregar                            |

### 15.1. Mensajes de estado vacío

| Lugar                         | Mensaje                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| Últimos pagos                 | «Esperando pago de S/ 97.00…»                                |
| Pedidos → Por pagar           | «No hay pedidos por cobrar.»                                 |
| Pedidos → Listos              | «Nada listo por ahora.»                                      |
| Cocina                        | «Sin pedidos pendientes.»                                    |
| Constancias por conciliar     | «No hay validaciones con constancia pendientes.»             |

---

## 16. Avisos y comunicaciones

### 16.1. Dentro de la caja

| Evento                                 | Forma                                   |
| -------------------------------------- | --------------------------------------- |
| Pago nuevo recibido                    | Aparece en la lista, vibración corta    |
| Pedido listo                           | Vibración y punto en Pedidos            |
| Estado de cobros empeora               | Sonido, vibración larga, aviso fijo     |
| Pago «Confirmando…» resuelto           | Aviso emergente con el resultado        |

### 16.2. Correo al dueño

| Motivo                                                     |
| ---------------------------------------------------------- |
| Un local lleva más de 5 minutos sin cobros activos          |
| Pagos con constancia sin respaldo                          |
| La conexión con Yallegó falló (clave revocada o sin alcance) |
| Resumen diario del cierre de turnos (opcional)             |

---

## 17. Accesibilidad

- Objetivos táctiles de 48 px en caja y 64 px en cocina.
- El estado nunca depende solo del color: chips y tarjetas llevan texto.
- Contraste AA en toda la interfaz; AAA en números de pedido y montos.
- Tamaño de texto de la caja respeta la configuración del sistema hasta 130 %.
- Sonidos siempre acompañados de un cambio visual.

---

## 18. Tono de las comunicaciones

- Directo y corto, de «tú». «Revisa que tenga internet», no «Se recomienda verificar
  la conectividad».
- Dice qué pasó y qué hacer: «El celular de cobros está desconectado desde las
  18:02. Revisa…».
- Sin tecnicismos frente a cajeras: «celular de cobros», no «dispositivo»; «pago»,
  no «transacción».
- Montos siempre como `S/ 97.00`.
