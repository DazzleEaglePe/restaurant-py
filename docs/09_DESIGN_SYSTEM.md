# 09 — Sistema de Diseño

> **Estado:** estructura y reglas funcionales definidas. **La línea gráfica (marca,
> paleta, tipografía, ilustración) está pendiente** de las referencias que se
> entregarán. Las secciones marcadas con ⏳ se completan con ellas.

---

## 1. Principios de diseño

1. **Se lee de un vistazo.** La cajera mira el celular entre cliente y cliente; la
   cocina, a un metro con las manos ocupadas; el cliente, a varios metros.
2. **El estado manda.** Cada pantalla gira en torno a un estado (pagado, en
   preparación, listo, celular caído). Su color y su texto son lo más visible.
3. **Un toque, una acción.** Botones grandes, sin menús escondidos en el flujo de cobro.
4. **Nada se pierde en silencio.** Todo cambio importante tiene una señal visual y,
   cuando corresponde, sonora o háptica.
5. **Un sistema para todas las superficies.** Caja, salón, cocina y pantalla pública comparten
   tokens y componentes; cambian la escala y la densidad.

---

## 2. Identidad ⏳

### 2.1. Marca del producto

Pendiente: nombre comercial (P1), logotipo, tono visual.

### 2.2. Marca del restaurante

La pantalla pública es del restaurante, no del producto: muestra su logo y su
color de acento (RF-TEN-005, RF-PUB-006). El producto solo aparece como una firma
discreta en una esquina. La caja y la administración usan la marca del producto.

### 2.3. Relación con Yallegó

Este producto tiene su propia marca. Yallegó aparece solo donde la cajera o el
dueño necesitan saber que el pago se verificó con Yallegó (insignia en el detalle
del pago y en la conexión). Se reutilizan de Yallegó la base técnica
(`packages/design-tokens`, shadcn/ui, Tailwind) y los colores de billetera.

---

## 3. Color

### 3.1. Paleta de marca ⏳

| Token                 | Uso                                  | Valor |
| --------------------- | ------------------------------------ | ----- |
| `--color-brand-500`   | Acción principal, pestaña activa     | ⏳    |
| `--color-brand-600`   | Hover y presionado                   | ⏳    |
| `--color-brand-50`    | Fondos suaves de selección           | ⏳    |
| `--color-accent-500`  | Destacados puntuales                 | ⏳    |

### 3.2. Colores de estado del pedido (definidos por función)

El valor exacto se ajusta con la paleta, pero el **significado no cambia**.

| Estado            | Rol de color       | Referencia provisional | Texto que lo acompaña |
| ----------------- | ------------------ | ---------------------- | --------------------- |
| `POR_PAGAR`       | Neutro             | Gris 500               | «Por pagar»           |
| `EN_ESPERA`       | Atención           | Ámbar 500              | «En espera»           |
| `EN_PREPARACION`  | Progreso           | Azul 500               | «En preparación»      |
| `LISTO`           | Éxito, destacado   | Verde 500              | «Listo»               |
| `ENTREGADO`       | Neutro apagado     | Gris 400               | «Entregado»           |
| `CANCELADO`       | Error              | Rojo 500               | «Cancelado»           |

### 3.3. Tipo de pedido

| Tipo             | Rol de color       | Referencia provisional | Etiqueta         |
| ---------------- | ------------------ | ---------------------- | ---------------- |
| Para comer aquí  | Categoría A        | Violeta 500            | «AQUÍ · Mesa 5»  |
| Para llevar      | Categoría B        | Naranja 500            | «LLEVAR»         |

Deben distinguirse entre sí y de los colores de estado, también para personas con
daltonismo (comprobar con simulación de deuteranopía y protanopía).

### 3.4. Estado de cobros

| Estado del local     | Rol de color | Chip                    |
| -------------------- | ------------ | ----------------------- |
| Activo               | Éxito        | ● Cobros OK             |
| Demorado             | Advertencia  | ● Cobros demorados      |
| Desconectado, Sin servicio, Conexión inválida | Error | ● Sin cobros |
| Sin celular, Caja sin internet | Neutro | ● Sin celular / ● Sin internet |

### 3.5. Demora en cocina

| Tiempo desde el pago              | Tratamiento de la tarjeta              |
| --------------------------------- | -------------------------------------- |
| Menor al umbral de alerta         | Normal                                 |
| Entre alerta y crítico            | Borde y contador en ámbar              |
| Mayor al crítico                  | Borde y contador en rojo, fondo tenue  |

### 3.6. Colores de billetera

Se reutilizan los de Yallegó (`~/Desktop/yallego/docs/09_DESIGN_SYSTEM.md` §3.4).
Las billeteras se muestran con su nombre y color, sin logotipos de terceros salvo
autorización.

### 3.7. Escala neutra y verificación de contraste ⏳

Escala de 50 a 950. Todo par texto/fondo se verifica: AA en general, AAA en
números de pedido y montos (RNF-USA-004).

---

## 4. Tipografía ⏳

### 4.1. Familias

| Uso         | Familia | Requisito                                                       |
| ----------- | ------- | --------------------------------------------------------------- |
| Interfaz    | ⏳      | Legible en pantallas chicas; buen soporte de español           |
| Cifras      | ⏳      | Números tabulares (montos y números de pedido alineados)       |

### 4.2. Escala por superficie

Los tamaños mínimos son requisitos; la escala completa se ajusta con la familia.

| Elemento                     | Caja (celular)  | Cocina (tablet 10") | Pantalla pública (1080p) |
| ---------------------------- | --------------- | ------------------- | ------------------------ |
| Número de pedido             | 20 px           | 40 px               | **≥ 96 px**              |
| Monto principal              | 40 px           | —                   | —                        |
| Código de seguridad          | 36 px, espaciado | —                  | —                        |
| Nombre de ítem               | 16 px           | 24 px               | —                        |
| Nombre del cliente           | 14 px           | 20 px; 32 px en «Para mesa» | 56 px              |
| Título de columna            | —               | —                   | 48 px                    |
| Texto de apoyo               | 14 px           | 18 px               | —                        |
| Botón principal              | 16 px           | 22 px               | —                        |

### 4.3. Tratamiento de cifras

- Montos: `S/ 97.00`, con espacio fino entre `S/` y el número y siempre dos decimales.
- Números de pedido: `#0042` con cuatro dígitos.
- Código de seguridad: dígitos separados (`3 1 5`) para leerlo en voz alta.

---

## 5. Espaciado y disposición

### 5.1. Escala

Base de 4 px: 4, 8, 12, 16, 24, 32, 48, 64.

### 5.2. Objetivos táctiles

| Superficie | Mínimo  | Botón principal                          |
| ---------- | ------- | ---------------------------------------- |
| Caja       | 48 px   | 56 px de alto, ancho completo            |
| Cocina     | 64 px   | 72 px de alto, ancho de la tarjeta       |

### 5.3. Zonas de la caja

Acciones principales en el tercio inferior (uso con una mano). Encabezado con el
local y el chip de cobros; navegación inferior fija.

### 5.4. Radios y elevación ⏳

Se definen con la línea gráfica.

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
| `CobroCandidatoCard`   | Caja            | Pago recibido con monto, nombre, hora, código e insignia «Coincide» |
| `DetallePago`          | Caja            | Monto grande, código de seguridad, comparación con el saldo     |
| `TecladoEfectivo`      | Caja            | Atajos y teclado numérico, vuelto grande                        |
| `ChipCobros`           | Caja, admin     | Estado del celular de cobros                                    |
| `AvisoCobros`          | Caja            | Aviso fijo con causa y qué revisar                              |
| `EstadoPedidoBadge`    | Todas           | Color y texto del estado                                        |
| `TipoPedidoBadge`      | Caja, cocina    | AQUÍ · Mesa / LLEVAR                                            |
| `TarjetaCocina`        | Cocina          | Pedido con ítems, tiempo, botón de avance y deshacer            |
| `TarjetaParaMesa`      | Cocina          | Pedido listo para mesa: número, nombre y zona en grande, «Entregado» |
| `SalonPedidoCard`      | Salón           | Pedido para mesa: número, mesa, nombre, platos y «Entregado»    |
| `ColumnaPublica`       | Pantalla pública | Lista de números y nombres; animación de entrada               |
| `Monto`                | Todas           | Formato `S/ 0.00` con cifras tabulares                          |
| `ResumenTurno`         | Caja, admin     | Totales por método y diferencia                                 |

---

## 7. Especificación de componentes clave

### 7.1. `CobroCandidatoCard`

| Parte              | Regla                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| Monto              | Lo más grande de la tarjeta                                              |
| Insignia «Coincide» | Solo con monto igual al saldo; color de éxito + ícono de check          |
| Nombre del pagador | Una línea, con elipsis                                                  |
| Hora y código      | Misma línea; el código con cifras tabulares                             |
| Nuevo              | Entra arriba con un resaltado de 1.5 s                                  |
| Seleccionado       | Borde de 2 px en color de marca (como el recuadro rojo del boceto)       |

### 7.2. `TarjetaCocina`

| Parte              | Regla                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| Franja superior    | Color del tipo de pedido, con «AQUÍ · M5» o «LLEVAR»                    |
| Número y tiempo    | Número a 40 px; tiempo transcurrido con el color de demora              |
| Ítems              | Cantidad en negrita; platos del combo y notas debajo, con sangría  |
| Botón              | «PREPARAR» o «LISTO», 72 px, ancho completo                             |
| Deshacer           | Enlace sobre el botón durante 10 s                                      |

### 7.3. `AvisoCobros`

| Parte          | Regla                                                         |
| -------------- | ------------------------------------------------------------- |
| Posición       | Bajo el encabezado, empuja el contenido; no flota encima       |
| Título         | Qué pasó, con la hora                                          |
| Cuerpo         | Qué revisar, en lista corta                                    |
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
| Pedido listo (pública)       | Entrada en la columna + pulso del fondo      | 300 ms + 8 s |
| Pedido nuevo (cocina)        | Destello del borde                           | 600 ms   |
| Confirmación de pago         | Check que se dibuja                          | 400 ms   |

Respeta `prefers-reduced-motion`: se reemplazan por cambios de color sin movimiento.

---

## 10. Modo oscuro ⏳

Propuesta inicial, a confirmar con la línea gráfica:

| Superficie        | Tema                                                        |
| ----------------- | ----------------------------------------------------------- |
| Caja              | Claro por defecto (se usa a pleno día en el mostrador)       |
| Cocina            | Oscuro (menos reflejo, colores de estado resaltan más)       |
| Pantalla pública  | Según la marca del restaurante                              |
| Administración    | Claro, con oscuro opcional                                  |

---

## 11. Sonidos

| Evento                    | Superficie       | Carácter                     |
| ------------------------- | ---------------- | ---------------------------- |
| Pedido nuevo              | Cocina           | Corto y agudo                |
| Pedido listo              | Pantalla pública | Campanilla                   |
| Cobros caídos             | Caja             | Alerta doble, distinta al resto |
| Pago recibido             | Caja             | Opcional, suave              |

---

## 12. Configuración de tokens

Mismo esquema que Yallegó: tokens en `packages/design-tokens` (JSON → CSS variables
y preset de Tailwind). Los tokens de estado son semánticos (`--color-estado-listo`)
y apuntan a la paleta, de modo que cambiar la marca no cambia significados.

---

## 13. Referencias que se necesitan ⏳

| #   | Referencia                                                             | Para                         |
| --- | ---------------------------------------------------------------------- | ---------------------------- |
| R1  | Nombre comercial y, si existe, logotipo                                | Identidad                    |
| R2  | Dos o tres productos o apps cuyo estilo te guste                       | Paleta, tipografía, radios   |
| R3  | Ejemplos de pantallas de cocina o de pedidos listos que te gusten      | Cocina y pantalla pública    |
| R4  | Logo y colores del restaurante piloto                                  | Pantalla pública             |
| R5  | ¿La marca se parece a Yallegó (familia de productos) o es independiente? | Dirección general          |

---

## 14. Lista de verificación de calidad

- [ ] Todo estado tiene color **y** texto.
- [ ] Contraste AA en toda la interfaz; AAA en números de pedido y montos.
- [ ] Número de pedido legible a 6 m en la pantalla pública.
- [ ] Botones de cocina usables con un dedo y sin precisión.
- [ ] Flujo de cobro con Yape en 3 toques cuando el pago ya llegó.
- [ ] Pantalla pública sin montos ni datos del pagador.
- [ ] Animaciones con alternativa para movimiento reducido.
- [ ] Probado en un Android de gama media a 360 px de ancho.
