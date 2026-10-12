# 09 — Sistema de Diseño

> **Estado:** línea gráfica definida el 2026-10-12: dirección **Marino**, con modo
> claro (Marino clásico) y modo oscuro (Marino noche).
> **Fuente en vectores:** `design/marca/resto_Manual_Marino.ai` (10 mesas de trabajo).
> Las exploraciones previas están en `design/marca/resto_LineaGrafica.ai` y
> `design/marca/resto_Paletas_B.ai`.

---

## 1. Principios de diseño

1. **Se lee de un vistazo.** La cajera mira el celular entre cliente y cliente; la
   cocina, a un metro con las manos ocupadas; el cliente, a varios metros.
2. **El estado manda.** Cada pantalla gira en torno a un estado (pagado, en
   preparación, listo, celular caído). Su color y su texto son lo más visible.
3. **Un toque, una acción.** Botones grandes, sin menús escondidos en el flujo de cobro.
4. **Nada se pierde en silencio.** Todo cambio importante tiene una señal visual y,
   cuando corresponde, sonora o háptica.
5. **Un sistema para todas las superficies.** Caja, salón, cocina y pantalla pública
   comparten tokens y componentes; cambian la escala, la densidad y el modo.

---

## 2. Identidad

### 2.1. Marca del producto

| Elemento        | Definición                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Nombre          | «resto», nombre de trabajo (el comercial sigue pendiente, P1)                                       |
| Mascota         | Campana de plato con perilla, dos ojos, sonrisa y tres rayas de «ding»: el pedido está listo        |
| Logotipo        | Mascota + «resto» en Nunito ExtraBold, minúsculas                                                   |
| Versiones       | Principal (horizontal), apilado e isotipo (la mascota sola)                                         |
| Área de protección | Un margen libre igual a la mitad de la altura de la mascota                                      |
| Tamaño mínimo   | Isotipo 24 px; logo principal 96 px de ancho                                                       |
| Construcción    | Cuadrícula de 10 × 10 u: campana de 4 u de radio, plato 9,4 × 0,9 u, perilla Ø 1 u, ojos Ø 0,7 u, rayas a 35°, 90° y 145° |
| Fondos válidos  | Arena, marino, noche, blanco (una tinta) y negativo                                                 |
| Usos incorrectos | Estirar, cambiar colores, rotar o poner sobre fondos con poco contraste                            |

**Expresiones de la mascota**

| Expresión | Uso                                                        |
| --------- | ---------------------------------------------------------- |
| Reposo    | Estado normal y pantallas vacías                           |
| Listo     | Un pedido pasa a «Listo»: también el sonido y la animación |
| Cargando  | Procesos en curso, como confirmar un pago                  |
| Alerta    | El celular de cobros se cayó o algo pide atención          |

La mascota acompaña, no protagoniza: aparece en estados vacíos, avisos, el ícono y
el «ding». Nunca dentro de botones ni sobre datos de pago.

### 2.2. Marca del restaurante («con resto»)

El producto lo usan muchos restaurantes. En lo que ven sus clientes (pantalla
pública, ticket, sticker, tarjeta QR) y en el encabezado de la caja, **el
restaurante es el protagonista** y el producto aparece como un sello pequeño:
mascota + «con resto».

| Regla | Detalle                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------- |
| 1     | El logo del restaurante, o su nombre en Nunito, va siempre primero y más grande                     |
| 2     | «con resto» mide como máximo un tercio de la altura del nombre                                     |
| 3     | El restaurante elige **un** color de acento de la lista; el resto del sistema no cambia            |
| 4     | En la cocina, los colores de estado nunca cambian                                                  |
| 5     | En la pantalla pública, el acento va en el nombre y en «En preparación»; «Listos» siempre en verde |

Colores de acento permitidos (contraste verificado con su texto):

| Nombre   | HEX       | Texto encima |
| -------- | --------- | ------------ |
| Turquesa | `#0F7C80` | Blanco       |
| Ámbar    | `#E0A21B` | Oscuro       |
| Coral    | `#FF6B57` | Oscuro       |
| Brasa    | `#C8402B` | Blanco       |
| Morado   | `#5B0A6E` | Blanco       |
| Verde    | `#1F7A4D` | Blanco       |

### 2.3. Relación con Yallegó

Este producto tiene su propia marca. Yallegó aparece solo donde la cajera o el
dueño necesitan saber que el pago se verificó con Yallegó (insignia en el detalle
del pago y en la conexión). Se reutilizan de Yallegó la base técnica
(`packages/design-tokens`, shadcn/ui, Tailwind) y los colores de billetera.

---

## 3. Color

### 3.1. Paleta de marca

**Marino clásico · modo claro** (caja, salón y administración)

| Token                    | Nombre   | HEX       | Proporción | Uso                                        |
| ------------------------ | -------- | --------- | ---------- | ------------------------------------------ |
| `--color-brand`          | Marino   | `#0E4C7A` | 40 %       | Logo, botones principales y navegación     |
| `--color-ink`            | Abismo   | `#0B2540` | 20 %       | Textos                                     |
| `--color-bg`             | Arena    | `#FFF8F0` | 20 %       | Fondo de la app                            |
| `--color-accent`         | Coral    | `#FF6B57` | 10 %       | «Ding» y destacados; nunca texto pequeño   |
| `--color-soft`           | Cielo    | `#E3EEF7` | 10 %       | Fondos suaves y selección                  |
| `--color-surface`        | Blanco   | `#FFFFFF` | —          | Tarjetas                                   |
| `--color-muted`          | Gris mar | `#56677A` | —          | Textos secundarios                         |
| `--color-line`           | Línea    | `#E6DCCD` | —          | Bordes                                     |

**Marino noche · modo oscuro** (cocina y pantalla pública)

| Token                    | Nombre          | HEX       | Proporción | Uso                                   |
| ------------------------ | --------------- | --------- | ---------- | ------------------------------------- |
| `--color-bg`             | Noche           | `#081C33` | 40 %       | Fondo                                 |
| `--color-surface`        | Marino profundo | `#103A5E` | 25 %       | Tarjetas                              |
| `--color-ink`            | Bruma           | `#EAF4FB` | 15 %       | Textos                                |
| `--color-muted`          | Cielo suave     | `#B9D9F3` | 10 %       | Textos secundarios                    |
| `--color-brand`          | Coral           | `#FF6B57` | 10 %       | Botones (con texto oscuro) y «ding»   |
| `--color-line`           | Borde noche     | `#1D4F7A` | —          | Bordes                                |

### 3.2. Colores de estado del pedido

Iguales en los dos modos y en todos los restaurantes. El color nunca va solo:
siempre con texto.

| Estado            | Nombre    | Fondo     | Texto     | Etiqueta          |
| ----------------- | --------- | --------- | --------- | ----------------- |
| `POR_PAGAR`       | Neutro    | `#E8ECEF` | `#3A4540` | «Por pagar»       |
| `PENDIENTE`       | Sol       | `#FFC926` | `#3A2A00` | «Pendiente»       |
| `EN_PREPARACION`  | Zanahoria | `#F96015` | `#2B0F00` | «En preparación»  |
| `LISTO`           | Kiwi      | `#9ABC05` | `#142000` | «Listo»           |
| `ENTREGADO`       | Gris      | `#C9CFCB` | `#2E3532` | «Entregado»       |
| `CANCELADO`       | Tomate    | `#D52518` | `#FFFFFF` | «Cancelado»       |

### 3.3. Tipo de pedido

No usa colores de estado, para no confundirlos: se distingue por texto y forma.

| Tipo             | Forma                          | Etiqueta            |
| ---------------- | ------------------------------ | ------------------- |
| Para llevar      | Chip relleno con el color de texto | «LLEVAR»        |
| Para comer aquí  | Chip con borde                 | «AQUÍ · TERRAZA»    |

### 3.4. Estado de cobros

| Estado del local     | Fondo     | Texto     | Punto     | Chip                 |
| -------------------- | --------- | --------- | --------- | -------------------- |
| Activo               | `#E3F4D6` | `#0F5A2A` | `#2E9E4F` | Cobros OK            |
| Demorado             | `#FFF1C7` | `#5A4100` | `#E0A800` | Cobros demorados     |
| Desconectado, Sin servicio, Conexión inválida | `#FBE0DD` | `#8A1A10` | `#D52518` | Sin cobros |
| Sin celular, Caja sin internet | `#ECEFED` | `#3A4540` | `#9AA39E` | Sin celular / Sin internet |

En modo noche, «Cobros OK» usa fondo `#16433A` y texto `#B8F0C9`.

### 3.5. Demora en cocina

| Tiempo desde el pago              | Tratamiento de la tarjeta              |
| --------------------------------- | -------------------------------------- |
| Menor al umbral de alerta         | Normal                                 |
| Entre alerta y crítico            | Borde y contador en sol                |
| Mayor al crítico                  | Borde y contador en tomate             |

### 3.6. Colores de billetera

Se reutilizan los de Yallegó (`~/Desktop/yallego/docs/09_DESIGN_SYSTEM.md` §3.4).
Las billeteras se muestran con su nombre y color, sin logotipos de terceros salvo
autorización.

### 3.7. Contraste

- Marino con texto blanco: 9,0:1. Coral siempre con texto oscuro (6,2:1 sobre noche);
  con blanco no llega a AA.
- Bruma sobre noche: 15,6:1. Cielo suave sobre marino profundo: 8,0:1.
- Estados con el texto indicado en §3.2: todos ≥ 4,5:1.
- AAA (≥ 7:1) en números de pedido y montos (RNF-USA-004).

---

## 4. Tipografía

### 4.1. Familias

| Uso                    | Familia          | Pesos                       |
| ---------------------- | ---------------- | --------------------------- |
| Logo y títulos         | Nunito           | ExtraBold                   |
| Interfaz y botones     | Nunito Sans (web) · Nunito (diseños) | SemiBold, Bold |
| Cifras                 | Las mismas, con `font-variant-numeric: tabular-nums` | — |

Ambas familias son de Google Fonts.

### 4.2. Escala por superficie

| Elemento                     | Caja (celular)  | Cocina (pantalla)  | Pantalla pública (1080p) |
| ---------------------------- | --------------- | ------------------- | ------------------------ |
| Número de pedido             | 20 px           | 40 px               | **≥ 96 px**              |
| Monto principal              | 40 px           | —                   | —                        |
| Código de seguridad          | 36 px, espaciado | —                  | —                        |
| Nombre de ítem               | 16 px           | 24 px               | —                        |
| Nombre del cliente           | 14 px           | 20 px               | 56 px                    |
| Título de columna            | —               | —                   | 48 px                    |
| Texto de apoyo               | 14 px           | 18 px               | —                        |
| Botón principal              | 16 px           | 22 px               | —                        |

En el celular de cocina se usa la escala de la caja, con el número de pedido a 24 px
y botones de 56 px.

### 4.3. Tratamiento de cifras

- Montos: `S/ 97.00`, con espacio fino entre `S/` y el número y siempre dos decimales.
- Números de pedido: `#0042` con cuatro dígitos.
- Código de seguridad: dígitos separados (`3 1 5`) para leerlo en voz alta.

---

## 5. Espaciado y disposición

### 5.1. Escala

Base de 4 px: 4, 8, 12, 16, 24, 32, 48, 64.

### 5.2. Objetivos táctiles

| Superficie        | Mínimo  | Botón principal                          |
| ----------------- | ------- | ---------------------------------------- |
| Caja              | 48 px   | 56 px de alto, ancho completo            |
| Cocina (celular)  | 56 px   | 64 px de alto, ancho completo            |
| Cocina (pantalla) | 64 px   | 72 px de alto, ancho de la tarjeta       |

### 5.3. Zonas de la caja

Acciones principales en el tercio inferior (uso con una mano). Encabezado con el
local y el chip de cobros; navegación inferior fija.

### 5.4. Radios y elevación

| Elemento            | Radio                          |
| ------------------- | ------------------------------ |
| Tarjetas (claro)    | 20–24 px                       |
| Tarjetas (noche)    | 14–18 px                       |
| Botones             | 16 px                          |
| Chips               | Mitad de su alto (píldora)     |
| Ícono de app        | 26 % del lado                  |

Sin sombras marcadas: las tarjetas se separan con un borde de 1 px (`--color-line`)
y el fondo arena o noche.

---

## 6. Biblioteca de componentes

### 6.1. Fundamento técnico

Tailwind + shadcn/ui sobre `packages/ui`, con tokens de `packages/design-tokens`,
igual que Yallegó.

### 6.2. Inventario

| Componente             | Superficie      | Descripción                                                     |
| ---------------------- | --------------- | --------------------------------------------------------------- |
| `ProductoCard`         | Caja            | Foto, nombre, precio; estados normal, agotado, en el pedido     |
| `CategoriaChips`       | Caja            | Filtro horizontal con desplazamiento                            |
| `HojaItem`             | Caja            | Hoja inferior para cantidad y nota                              |
| `BarraPedido`          | Caja            | «Ver pedido · 5 · S/ 97.00»                                     |
| `DescuentosPedido`     | Caja            | Descuentos automáticos aplicados, lista para elegir y cortesías |
| `CobroCandidatoCard`   | Caja            | Pago recibido con monto, nombre, hora, código e insignia «Coincide» |
| `DetallePago`          | Caja            | Monto grande, código de seguridad, comparación con el saldo     |
| `TecladoEfectivo`      | Caja            | Atajos y teclado numérico, vuelto grande                        |
| `ChipCobros`           | Caja, admin     | Estado del celular de cobros                                    |
| `AvisoCobros`          | Caja            | Aviso fijo con causa y qué revisar                              |
| `EstadoPedidoBadge`    | Todas           | Color y texto del estado                                        |
| `TipoPedidoBadge`      | Caja, cocina    | AQUÍ · ZONA / LLEVAR                                            |
| `TarjetaCocina`        | Cocina          | Pedido con ítems, tiempo, botón de avance y deshacer            |
| `SalonPedidoCard`      | Salón           | Pedido para mesa: número, nombre, zona, detalle, «Entregado» y «Observación» |
| `HojaObservacion`      | Salón, caja     | Tipo y comentario de un reclamo; en caja, las opciones para resolverlo |
| `ColumnaPublica`       | Pantalla pública | Lista de números y nombres; animación de entrada               |
| `Monto`                | Todas           | Formato `S/ 0.00` con cifras tabulares                          |
| `ResumenTurno`         | Caja, admin     | Totales por método y diferencia                                 |
| `Mascota`              | Todas           | Isotipo con sus cuatro expresiones                              |
| `SelloConResto`        | Pantalla pública, ticket | Mascota pequeña + «con resto», claro u oscuro          |
| `MarcaRestaurante`     | Pantalla pública, caja, ticket | Logo o nombre del restaurante con su color de acento |

---

## 7. Especificación de componentes clave

### 7.1. `CobroCandidatoCard`

| Parte               | Regla                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Monto               | Lo más grande de la tarjeta                                              |
| Insignia «Coincide» | Solo con monto igual al saldo; color de éxito + ícono de check          |
| Nombre del pagador  | Una línea, con elipsis                                                  |
| Hora y código       | Misma línea; el código con cifras tabulares                             |
| Nuevo               | Entra arriba con un resaltado de 1.5 s                                  |
| Seleccionado        | Borde de 2 px en marino                                                 |

### 7.2. `TarjetaCocina`

| Parte              | Regla                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| Encabezado         | Número a 40 px y tiempo transcurrido con el color de demora             |
| Tipo               | Chip «LLEVAR» relleno o «AQUÍ · ZONA» con borde, debajo del número      |
| Ítems              | Cantidad en negrita; platos del combo y notas debajo, con sangría       |
| Botón              | «PREPARAR» (coral, texto oscuro) o «LISTO» (kiwi), 72 px, ancho completo |
| Deshacer           | Enlace sobre el botón durante 10 s                                      |

### 7.3. `AvisoCobros`

| Parte          | Regla                                                         |
| -------------- | ------------------------------------------------------------- |
| Posición       | Bajo el encabezado, empuja el contenido; no flota encima       |
| Título         | Qué pasó, con la hora                                          |
| Cuerpo         | Qué revisar, en lista corta                                    |
| Ilustración    | Mascota en expresión «Alerta», pequeña                         |
| Acción         | «Validar con constancia» cuando aplica                         |
| Cierre         | No tiene; desaparece cuando el estado vuelve a Activo          |

---

## 8. Iconografía

Lucide (igual que Yallegó), trazo de 2 px. Correspondencias:

| Concepto              | Ícono             |
| --------------------- | ----------------- |
| Para llevar           | `shopping-bag`    |
| Para comer aquí       | `utensils`        |
| En preparación        | `chef-hat`        |
| Listo                 | `bell-ring`       |
| Celular de cobros     | `smartphone`      |
| Sin cobros            | `wifi-off`        |
| Efectivo              | `banknote`        |
| Constancia            | `receipt`         |

---

## 9. Movimiento

| Evento                       | Animación                                    | Duración |
| ---------------------------- | -------------------------------------------- | -------- |
| Pago nuevo en la lista       | Entrada desde arriba + resaltado             | 200 ms + 1.5 s |
| Pedido listo (pública)       | Entrada en la columna + pulso del fondo; la mascota hace «ding» | 300 ms + 8 s |
| Pedido nuevo (cocina)        | Destello del borde                           | 600 ms   |
| Confirmación de pago         | Check que se dibuja                          | 400 ms   |
| Cargando                     | Los tres puntos de la mascota se encienden en secuencia | 900 ms en bucle |

Respeta `prefers-reduced-motion`: se reemplazan por cambios de color sin movimiento.

---

## 10. Modos claro y noche

| Superficie        | Modo                                                        |
| ----------------- | ----------------------------------------------------------- |
| Caja              | Marino clásico (se usa a pleno día en el mostrador)         |
| Salón (mesera)    | Marino clásico                                              |
| Cocina            | Marino noche (menos reflejo; los estados resaltan más)      |
| Pantalla pública  | Marino noche, con el nombre y el acento del restaurante     |
| Administración    | Marino clásico; noche opcional más adelante                 |

---

## 11. Sonidos

| Evento                    | Superficie       | Carácter                                  |
| ------------------------- | ---------------- | ----------------------------------------- |
| Pedido nuevo              | Cocina           | Corto y agudo                             |
| Pedido listo              | Pantalla pública, salón | El «ding» de la marca: campanilla breve |
| Cobros caídos             | Caja             | Alerta doble, distinta al resto           |
| Pago recibido             | Caja             | Opcional, suave                           |

---

## 12. Configuración de tokens

Mismo esquema que Yallegó: tokens en `packages/design-tokens` (JSON → CSS variables
y preset de Tailwind). Dos temas, `claro` y `noche`, con los mismos nombres de token
(§3.1). Los tokens de estado son semánticos (`--color-estado-listo`) y no cambian
entre temas ni entre restaurantes. El acento del restaurante se inyecta en tiempo de
ejecución como `--color-restaurante` y solo se usa en `MarcaRestaurante` y en la
pantalla pública.

---

## 13. Fuentes de la línea gráfica

| Archivo o fuente                               | Contenido                                                    |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `design/marca/resto_Manual_Marino.ai`          | Manual definitivo en vectores                                |
| `design/marca/resto_Paletas_B.ai`              | Cinco paletas de la mascota (Chicha, Brasa, Marino, Cacao, Lúcuma) |
| `design/marca/resto_LineaGrafica.ai`           | Primeras tres direcciones (Fresco, Huerta, Bosque)           |
| Chat «Diseñar tablero de marca» en ChatGPT     | Exploraciones con su generador de imágenes: paletas, manual, adaptación por restaurante y variantes de Marino |

---

## 14. Lista de verificación de calidad

- [ ] Todo estado tiene color **y** texto.
- [ ] Contraste AA en toda la interfaz; AAA en números de pedido y montos.
- [ ] Coral nunca como texto pequeño ni con texto blanco encima.
- [ ] Número de pedido legible a 6 m en la pantalla pública.
- [ ] Botones de cocina usables con un dedo y sin precisión.
- [ ] Flujo de cobro con Yape en 3 toques cuando el pago ya llegó.
- [ ] Pantalla pública sin montos ni datos del pagador.
- [ ] «con resto» nunca más grande que un tercio del nombre del restaurante.
- [ ] Animaciones con alternativa para movimiento reducido.
- [ ] Probado en un Android de gama media a 360 px de ancho.
