# 05 — Modelo de Datos

---

## 1. Decisiones de modelado

| Decisión                                                         | Motivo                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| PostgreSQL 16 con Row Level Security                             | Segunda capa de aislamiento entre negocios, igual que Yallegó                            |
| Claves `uuid` generadas en base de datos (`gen_random_uuid()`)    | No revelan volumen ni orden; seguras en URLs                                             |
| `tenant_id` en toda tabla de negocio, aunque se pueda deducir    | RLS simple y uniforme; índices por negocio                                               |
| Dinero en `numeric(10,2)` y moneda `PEN`                         | Sin errores de coma flotante                                                             |
| Fechas en `timestamptz`; la fecha de operación del pedido en `date` local | El «día» del restaurante es el de Lima, no el del servidor                      |
| Copias (snapshots) de nombre, precio y platos en los ítems        | El pedido no cambia si después se edita la carta                                         |
| Estados como `enum` de PostgreSQL                                | Valores cerrados y validados por el motor                                                |
| Índice único parcial para el uso de un cobro                     | Un cobro de Yallegó en un solo pago activo (ver `04_ARQUITECTURA_SOFTWARE.md` §5.2)       |
| Copia local de cobros de Yallegó                                 | Lista rápida en caja y conciliación sin depender de Yallegó                              |
| Nombre del pagador cifrado (AES-256-GCM) con campo de búsqueda aparte | Dato personal; la caja necesita leerlo, la base no debe exponerlo en claro           |
| Prisma como ORM; este documento es la referencia del esquema     | Mismo flujo de migraciones que Yallegó                                                   |

---

## 2. Diagrama entidad-relación

```
negocios ─┬─< locales ─┬─< zonas ─< mesas
          │            ├─< pantallas
          │            ├─< turnos_caja ─< movimientos_caja
          │            ├─< contadores_pedido
          │            ├─< incidencias_cobros
          │            └─< pedidos ─┬─< pedido_items ─< pedido_item_opciones
          │                         └─< pagos >── yallego_cobros
          │
          ├─< membresias >── usuarios ─< refresh_tokens
          │       └─< membresia_locales >── locales
          │
          ├─< categorias ─< productos ─┬─< combo_componentes
          │                            ├─< grupos_opciones ─< opciones
          │                            └─< producto_locales >── locales
          │
          ├── yallego_conexiones ─┬─< yallego_celulares >── locales
          │                       ├─< yallego_cobros
          │                       └─< yallego_eventos
          │
          ├─< auditoria
          └─< outbox_eventos
```

`─<` uno a muchos · `>──` muchos a uno.

---

## 3. Esquema DDL

Las secciones están en orden de lectura. La migración inicial crea las tablas de
Yallegó (§3.9) antes que `pagos` (§3.8), que las referencia.

### 3.1. Tipos

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE estado_negocio      AS ENUM ('ACTIVO', 'SUSPENDIDO');
CREATE TYPE rol_usuario         AS ENUM ('OWNER', 'ADMIN', 'CAJERO', 'MESERO');
CREATE TYPE tipo_pantalla       AS ENUM ('COCINA', 'COCINA_MONITOR', 'PUBLICA');  -- COCINA_MONITOR: solo lectura (D23)
CREATE TYPE tipo_pedido         AS ENUM ('AQUI', 'LLEVAR');
CREATE TYPE estado_pedido       AS ENUM ('POR_PAGAR', 'PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO');
CREATE TYPE metodo_pago         AS ENUM ('EFECTIVO', 'BILLETERA');
CREATE TYPE verificacion_pago   AS ENUM ('YALLEGO', 'CONSTANCIA');
CREATE TYPE estado_pago         AS ENUM ('RESERVADO', 'CONFIRMADO', 'RECHAZADO', 'ANULADO');
CREATE TYPE estado_conciliacion AS ENUM ('PENDIENTE', 'CONCILIADO', 'REVISION', 'SIN_RESPALDO');
CREATE TYPE devolucion_pedido   AS ENUM ('EFECTIVO', 'BILLETERA', 'NO_DEVUELTO');
CREATE TYPE estado_turno        AS ENUM ('ABIERTO', 'CERRADO', 'VALIDADO', 'OBSERVADO');
CREATE TYPE tipo_movimiento     AS ENUM ('INGRESO', 'EGRESO', 'DEVOLUCION');
CREATE TYPE estado_conexion     AS ENUM ('PENDIENTE', 'CONECTADA', 'ERROR', 'DESCONECTADA');
CREATE TYPE estado_cobro_ylg    AS ENUM ('CAPTURED', 'CONFIRMED', 'DISPUTED', 'VOIDED');
CREATE TYPE conectividad_ylg    AS ENUM ('ONLINE', 'DEGRADED', 'OFFLINE');
CREATE TYPE estado_celular_ylg  AS ENUM ('ACTIVE', 'PAUSED', 'REVOKED');
CREATE TYPE estado_cobros_local AS ENUM ('ACTIVO', 'DEMORADO', 'DESCONECTADO', 'SIN_SERVICIO', 'CONEXION_INVALIDA', 'SIN_CELULAR');
CREATE TYPE origen_cobro        AS ENUM ('WEBHOOK', 'CONSULTA');
CREATE TYPE tipo_observacion    AS ENUM ('PEDIDO_EQUIVOCADO', 'FALTA_PLATO', 'OTRO');
CREATE TYPE resolucion_observacion AS ENUM ('CORREGIDO', 'CANCELADO', 'SIN_CAMBIOS');
CREATE TYPE tipo_descuento      AS ENUM ('PORCENTAJE', 'MONTO');
CREATE TYPE alcance_descuento   AS ENUM ('PEDIDO', 'PRODUCTO', 'CATEGORIA');
```

### 3.2. Negocios, locales y usuarios

```sql
CREATE TABLE negocios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_comercial varchar(120) NOT NULL,
  razon_social     varchar(160),
  ruc              char(11),
  zona_horaria     varchar(64) NOT NULL DEFAULT 'America/Lima',
  logo_url         text,
  color_acento     char(7),
  estado           estado_negocio NOT NULL DEFAULT 'ACTIVO',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE locales (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre                 varchar(80) NOT NULL,
  direccion              varchar(200),
  activo                 boolean NOT NULL DEFAULT true,
  -- Configuración operativa (RF-TEN-003)
  ventana_pagos_min      smallint NOT NULL DEFAULT 15 CHECK (ventana_pagos_min BETWEEN 5 AND 60),
  permite_constancia     boolean NOT NULL DEFAULT true,
  monto_max_constancia   numeric(10,2),
  mesa_obligatoria       boolean NOT NULL DEFAULT false,
  cocina_alerta_min      smallint NOT NULL DEFAULT 10,
  cocina_critico_min     smallint NOT NULL DEFAULT 20,
  ocultar_listos_min     smallint NOT NULL DEFAULT 10,
  tiempo_base_min        smallint NOT NULL DEFAULT 20,     -- espera sugerida sin historial (04 §5.10)
  costo_taper_defecto    numeric(10,2) NOT NULL DEFAULT 1.00,  -- prellenado al crear productos (D21)
  -- Estado de cobros calculado (04 §5.5)
  estado_cobros          estado_cobros_local NOT NULL DEFAULT 'SIN_CELULAR',
  estado_cobros_desde    timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nombre)
);

CREATE TABLE usuarios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            citext NOT NULL UNIQUE,
  nombre           varchar(80) NOT NULL,
  password_hash    text,                     -- null hasta aceptar la invitación
  intentos_fallidos smallint NOT NULL DEFAULT 0,
  bloqueado_hasta  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE membresias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol         rol_usuario NOT NULL,
  activa      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, usuario_id)
);

-- Locales en los que puede operar un CAJERO o un MESERO. OWNER y ADMIN operan en todos.
CREATE TABLE membresia_locales (
  membresia_id uuid NOT NULL REFERENCES membresias(id) ON DELETE CASCADE,
  local_id     uuid NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  PRIMARY KEY (membresia_id, local_id)
);

CREATE TABLE refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  familia_id   uuid NOT NULL,
  token_hash   char(64) NOT NULL UNIQUE,
  expira_at    timestamptz NOT NULL,
  usado_at     timestamptz,
  revocado_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tokens_un_uso (           -- invitación y recuperación de contraseña
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  proposito   varchar(24) NOT NULL CHECK (proposito IN ('INVITACION', 'RECUPERACION')),
  token_hash  char(64) NOT NULL UNIQUE,
  expira_at   timestamptz NOT NULL,
  usado_at    timestamptz
);
```

### 3.3. Pantallas vinculadas

```sql
CREATE TABLE pantallas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  local_id      uuid NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  tipo          tipo_pantalla NOT NULL,
  nombre        varchar(60) NOT NULL,
  token_hash    char(64) UNIQUE,         -- null hasta que el equipo canjea su solicitud
  vinculada_at  timestamptz,
  ultima_conexion_at timestamptz,
  revocada_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- La pide el equipo sin vincular (D27). No tiene negocio hasta que un ADMIN la aprueba,
-- por eso no lleva RLS y se accede solo por código o por id + secreto.
CREATE TABLE solicitudes_vinculacion (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_hash   char(64) NOT NULL UNIQUE,   -- SHA-256 del código que muestra la pantalla
  secreto_hash  char(64) NOT NULL,          -- SHA-256 del secreto que solo guarda el equipo
  agente        varchar(200),               -- navegador y sistema del equipo, para mostrarlo al aprobar
  ip_origen     inet,
  tenant_id     uuid REFERENCES negocios(id) ON DELETE CASCADE,
  pantalla_id   uuid REFERENCES pantallas(id) ON DELETE CASCADE,
  aprobada_por  uuid REFERENCES usuarios(id),
  aprobada_at   timestamptz,
  canjeada_at   timestamptz,
  expira_at     timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((aprobada_at IS NULL) = (tenant_id IS NULL))
);
```

Un job borra cada hora las solicitudes vencidas o canjeadas hace más de un día.

### 3.4. Carta

```sql
CREATE TABLE categorias (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre     varchar(60) NOT NULL,
  orden      smallint NOT NULL DEFAULT 0,
  activa     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, nombre)
);

CREATE TABLE productos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  categoria_id     uuid NOT NULL REFERENCES categorias(id),
  nombre           varchar(80) NOT NULL,
  descripcion      varchar(300),
  precio           numeric(10,2) NOT NULL CHECK (precio >= 0),
  costo_taper      numeric(10,2) NOT NULL DEFAULT 0 CHECK (costo_taper >= 0),  -- para llevar (D18)
  foto_url         text,
  es_combo         boolean NOT NULL DEFAULT false,
  requiere_cocina  boolean NOT NULL DEFAULT true,
  orden            smallint NOT NULL DEFAULT 0,
  activo           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Componentes fijos de un combo (RF-CAR-003)
CREATE TABLE combo_componentes (
  combo_id     uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  producto_id  uuid NOT NULL REFERENCES productos(id),
  cantidad     smallint NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  tenant_id    uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  PRIMARY KEY (combo_id, producto_id)
);

-- Opciones a elegir (RF-CAR-004, COULD). No se crean en el MVP: los combos del
-- piloto son fijos (D9). Se dejan aquí para no rediseñar cuando se necesiten.
CREATE TABLE grupos_opciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto_id  uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre       varchar(60) NOT NULL,
  minimo       smallint NOT NULL DEFAULT 0,
  maximo       smallint NOT NULL DEFAULT 1,
  orden        smallint NOT NULL DEFAULT 0,
  CHECK (minimo >= 0 AND maximo >= minimo AND maximo > 0)
);

CREATE TABLE opciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  grupo_id      uuid NOT NULL REFERENCES grupos_opciones(id) ON DELETE CASCADE,
  nombre        varchar(60) NOT NULL,
  precio_extra  numeric(10,2) NOT NULL DEFAULT 0 CHECK (precio_extra >= 0),
  orden         smallint NOT NULL DEFAULT 0,
  activa        boolean NOT NULL DEFAULT true
);

-- Disponibilidad y precio por local (RF-CAR-006, 007, 009)
CREATE TABLE producto_locales (
  producto_id     uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  local_id        uuid NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  habilitado      boolean NOT NULL DEFAULT true,
  agotado         boolean NOT NULL DEFAULT false,
  precio_local    numeric(10,2) CHECK (precio_local >= 0),
  PRIMARY KEY (producto_id, local_id)
);
```

### 3.5. Zonas y mesas

```sql
CREATE TABLE zonas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  local_id   uuid NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  nombre     varchar(40) NOT NULL,
  piso       varchar(20),                  -- «1er piso», «2do piso»
  orden      smallint NOT NULL DEFAULT 0,
  activa     boolean NOT NULL DEFAULT true,
  UNIQUE (local_id, nombre)
);

-- Mesas numeradas (RF-MES-002, COULD). El piloto no las usa: basta con nombre y
-- zona (D12). Quedan para restaurantes que sí numeran sus mesas.
CREATE TABLE mesas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  local_id   uuid NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  zona_id    uuid NOT NULL REFERENCES zonas(id),
  numero     varchar(10) NOT NULL,
  capacidad  smallint,
  activa     boolean NOT NULL DEFAULT true,
  UNIQUE (local_id, numero)
);
```

### 3.6. Turnos de caja

```sql
CREATE TABLE turnos_caja (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  local_id           uuid NOT NULL REFERENCES locales(id),
  usuario_id         uuid NOT NULL REFERENCES usuarios(id),
  estado             estado_turno NOT NULL DEFAULT 'ABIERTO',
  fondo_inicial      numeric(10,2) NOT NULL CHECK (fondo_inicial >= 0),
  abierto_at         timestamptz NOT NULL DEFAULT now(),
  cerrado_at         timestamptz,
  cerrado_por        uuid REFERENCES usuarios(id),
  efectivo_esperado  numeric(10,2),
  efectivo_contado   numeric(10,2),
  diferencia         numeric(10,2),
  nota_cierre        varchar(300),
  -- Validación del administrador al final del día (RF-CAJ-008)
  validado_por       uuid REFERENCES usuarios(id),
  validado_at        timestamptz,
  comentario_validacion varchar(300)
);

-- Un usuario tiene como máximo un turno abierto (RF-CAJ-002)
CREATE UNIQUE INDEX turnos_un_abierto_por_usuario
  ON turnos_caja (usuario_id) WHERE estado = 'ABIERTO';

CREATE TABLE movimientos_caja (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  turno_id    uuid NOT NULL REFERENCES turnos_caja(id),
  tipo        tipo_movimiento NOT NULL,
  monto       numeric(10,2) NOT NULL CHECK (monto > 0),
  motivo      varchar(200) NOT NULL,
  pedido_id   uuid,                       -- en devoluciones
  usuario_id  uuid NOT NULL REFERENCES usuarios(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### 3.7. Pedidos

```sql
CREATE TABLE contadores_pedido (
  local_id   uuid NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  fecha      date NOT NULL,
  ultimo     integer NOT NULL,
  tenant_id  uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  PRIMARY KEY (local_id, fecha)
);

CREATE TABLE pedidos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  local_id           uuid NOT NULL REFERENCES locales(id),
  turno_id           uuid NOT NULL REFERENCES turnos_caja(id),
  fecha_operacion    date NOT NULL,
  numero             integer NOT NULL,
  tipo               tipo_pedido NOT NULL,
  mesa_id            uuid REFERENCES mesas(id),
  zona_id            uuid REFERENCES zonas(id),       -- obligatoria para AQUI si el local tiene zonas
  corrige_pedido_id  uuid REFERENCES pedidos(id),     -- pedido de corrección (04 §5.11)
  credito_correccion numeric(10,2) NOT NULL DEFAULT 0, -- valor de los ítems reemplazados
  nombre_cliente     varchar(40),
  estado             estado_pedido NOT NULL DEFAULT 'POR_PAGAR',
  total              numeric(10,2) NOT NULL CHECK (total >= 0),
  pagado             numeric(10,2) NOT NULL DEFAULT 0,
  taperes            smallint NOT NULL DEFAULT 0,     -- solo LLEVAR (D18)
  cargo_taper        numeric(10,2) NOT NULL DEFAULT 0, -- incluido en total
  descuento_total    numeric(10,2) NOT NULL DEFAULT 0, -- descuentos y cortesías del pedido
  tiempo_estimado_min smallint,                    -- el que se le dijo al cliente
  version            integer NOT NULL DEFAULT 1,
  idempotency_key    uuid NOT NULL,
  creado_por         uuid NOT NULL REFERENCES usuarios(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  pagado_at          timestamptz,
  preparacion_at     timestamptz,
  listo_at           timestamptz,
  entregado_at       timestamptz,
  entregado_por      uuid REFERENCES usuarios(id),
  cancelado_at       timestamptz,
  cancelado_por      uuid REFERENCES usuarios(id),
  motivo_cancelacion varchar(200),
  devolucion         devolucion_pedido,
  UNIQUE (local_id, fecha_operacion, numero),
  UNIQUE (tenant_id, idempotency_key),
  CHECK (tipo = 'AQUI' OR (mesa_id IS NULL AND zona_id IS NULL)),
  CHECK (tipo <> 'AQUI' OR nombre_cliente IS NOT NULL),  -- la mesera lo llama por su nombre (D12)
  CHECK (tipo = 'LLEVAR' OR (taperes = 0 AND cargo_taper = 0))
);

CREATE INDEX pedidos_local_activos
  ON pedidos (local_id, estado, pagado_at)
  WHERE estado IN ('POR_PAGAR', 'PENDIENTE', 'EN_PREPARACION', 'LISTO');
CREATE INDEX pedidos_local_fecha ON pedidos (local_id, fecha_operacion DESC, numero DESC);

CREATE TABLE pedido_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  pedido_id        uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id      uuid NOT NULL REFERENCES productos(id),
  nombre           varchar(80) NOT NULL,          -- copia
  precio_unitario  numeric(10,2) NOT NULL,        -- copia, incluye opciones
  cantidad         smallint NOT NULL CHECK (cantidad > 0),
  subtotal         numeric(10,2) NOT NULL,
  requiere_cocina  boolean NOT NULL,              -- copia
  nota             varchar(140),
  anulado_at       timestamptz,                   -- reemplazado en una corrección
  observacion_id   uuid,                          -- observación que lo anuló
  precio_lista     numeric(10,2) NOT NULL,        -- antes de descuentos y cortesías
  cortesia         boolean NOT NULL DEFAULT false,  -- por un descuento del 100 % configurado (D25)
  orden            smallint NOT NULL
);

-- v0.2, junto con grupos_opciones y opciones (RF-CAR-004)
CREATE TABLE pedido_item_opciones (
  item_id       uuid NOT NULL REFERENCES pedido_items(id) ON DELETE CASCADE,
  opcion_id     uuid NOT NULL REFERENCES opciones(id),
  tenant_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  grupo         varchar(60) NOT NULL,             -- copia
  nombre        varchar(60) NOT NULL,             -- copia
  precio_extra  numeric(10,2) NOT NULL,           -- copia
  PRIMARY KEY (item_id, opcion_id)
);
```

Descuentos y promociones (RF-DSC):

```sql
CREATE TABLE descuentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre        varchar(80) NOT NULL,                -- «Martes de ceviche»
  tipo          tipo_descuento NOT NULL,
  valor         numeric(10,2) NOT NULL CHECK (valor > 0),
  alcance       alcance_descuento NOT NULL,
  producto_id   uuid REFERENCES productos(id),
  categoria_id  uuid REFERENCES categorias(id),
  automatico    boolean NOT NULL DEFAULT false,
  dias_semana   smallint[],                          -- 1 = lunes … 7 = domingo; null = todos
  hora_desde    time,
  hora_hasta    time,
  vigente_desde date,
  vigente_hasta date,
  local_ids     uuid[],                              -- null = todos los locales
  activo        boolean NOT NULL DEFAULT true,
  CHECK (tipo <> 'PORCENTAJE' OR valor <= 100)
);

CREATE TABLE pedido_descuentos (
  pedido_id     uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  descuento_id  uuid REFERENCES descuentos(id),      -- null en un descuento libre
  tenant_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre        varchar(80) NOT NULL,                -- copia
  monto         numeric(10,2) NOT NULL,
  aplicado_por  uuid REFERENCES usuarios(id),        -- null si fue automático
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

Observaciones del pedido (RF-OBS):

```sql
CREATE TABLE observaciones_pedido (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  local_id              uuid NOT NULL REFERENCES locales(id),
  pedido_id             uuid NOT NULL REFERENCES pedidos(id),
  tipo                  tipo_observacion NOT NULL,
  comentario            varchar(300) NOT NULL,
  reportada_por         uuid NOT NULL REFERENCES usuarios(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  resolucion            resolucion_observacion,        -- null mientras está abierta
  comentario_resolucion varchar(300),
  pedido_correccion_id  uuid REFERENCES pedidos(id),
  diferencia            numeric(10,2),                 -- positiva: se cobró; negativa: se devolvió
  devolucion            devolucion_pedido,
  resuelta_por          uuid REFERENCES usuarios(id),
  resuelta_at           timestamptz
);

CREATE INDEX observaciones_abiertas ON observaciones_pedido (local_id) WHERE resolucion IS NULL;
```

### 3.8. Pagos

```sql
CREATE TABLE pagos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  local_id           uuid NOT NULL REFERENCES locales(id),
  pedido_id          uuid NOT NULL REFERENCES pedidos(id),
  turno_id           uuid NOT NULL REFERENCES turnos_caja(id),
  metodo             metodo_pago NOT NULL,
  verificacion       verificacion_pago,           -- null en efectivo
  estado             estado_pago NOT NULL,
  monto              numeric(10,2) NOT NULL CHECK (monto > 0),
  -- Efectivo
  recibido           numeric(10,2),
  vuelto             numeric(10,2),
  -- Billetera
  billetera          varchar(24),                 -- YAPE, PLIN_BBVA… (código de Yallegó)
  yallego_cobro_id   uuid REFERENCES yallego_cobros(id),
  intentos_confirmacion smallint NOT NULL DEFAULT 0,
  -- Constancia (RF-PAG-014)
  constancia_hora     timestamptz,
  constancia_nombre   bytea,                      -- cifrado
  constancia_operacion varchar(32),
  constancia_codigo   varchar(8),
  constancia_observacion varchar(200),            -- opcional (D11)
  estado_cobros_al_validar estado_cobros_local,   -- estado del celular en ese momento
  conciliacion       estado_conciliacion,         -- solo constancia
  conciliado_at      timestamptz,
  idempotency_key    uuid NOT NULL,
  creado_por         uuid NOT NULL REFERENCES usuarios(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  confirmado_at      timestamptz,
  rechazado_motivo   varchar(60),
  UNIQUE (tenant_id, idempotency_key),
  CHECK (metodo = 'EFECTIVO' OR verificacion IS NOT NULL),
  CHECK (verificacion IS DISTINCT FROM 'YALLEGO' OR yallego_cobro_id IS NOT NULL),
  CHECK (verificacion IS DISTINCT FROM 'CONSTANCIA' OR conciliacion IS NOT NULL)
);

-- Un cobro de Yallegó en un solo pago activo (RF-PAG-008, RNF-DISP-004)
CREATE UNIQUE INDEX pagos_cobro_un_uso
  ON pagos (yallego_cobro_id)
  WHERE yallego_cobro_id IS NOT NULL AND estado IN ('RESERVADO', 'CONFIRMADO');

CREATE INDEX pagos_pedido ON pagos (pedido_id);
CREATE INDEX pagos_constancia_pendiente
  ON pagos (local_id, monto, constancia_hora)
  WHERE verificacion = 'CONSTANCIA' AND conciliacion IN ('PENDIENTE', 'REVISION');
CREATE INDEX pagos_reservados ON pagos (created_at) WHERE estado = 'RESERVADO';
```

### 3.9. Integración con Yallegó

```sql
CREATE TABLE yallego_conexiones (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL UNIQUE REFERENCES negocios(id) ON DELETE CASCADE,
  estado                 estado_conexion NOT NULL DEFAULT 'PENDIENTE',
  api_key_cifrada        bytea NOT NULL,
  api_key_prefijo        varchar(24) NOT NULL,        -- yk_live_9f8c2a1e, para mostrar
  webhook_id             uuid,                        -- id del webhook en Yallegó
  webhook_secreto_cifrado bytea,
  webhook_secreto_anterior_cifrado bytea,             -- durante una rotación
  webhook_token          char(43) NOT NULL UNIQUE,    -- parte de la URL del webhook
  ultimo_error           varchar(200),
  verificada_at          timestamptz,
  prueba_recibida_at     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE yallego_celulares (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  conexion_id        uuid NOT NULL REFERENCES yallego_conexiones(id) ON DELETE CASCADE,
  yallego_device_id  uuid NOT NULL,
  local_id           uuid REFERENCES locales(id),     -- null = sin asignar
  etiqueta           varchar(120) NOT NULL,
  modelo             varchar(120),
  estado             estado_celular_ylg NOT NULL,
  conectividad       conectividad_ylg NOT NULL,
  ultimo_reporte_at  timestamptz,
  lecturas_online    smallint NOT NULL DEFAULT 0,      -- histéresis (04 §5.5)
  actualizado_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conexion_id, yallego_device_id)
);

CREATE TABLE yallego_cobros (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  conexion_id         uuid NOT NULL REFERENCES yallego_conexiones(id) ON DELETE CASCADE,
  yallego_id          uuid NOT NULL,
  yallego_device_id   uuid NOT NULL,
  local_id            uuid REFERENCES locales(id),    -- según el celular; null si no está asignado
  billetera           varchar(24) NOT NULL,
  monto               numeric(10,2) NOT NULL,
  moneda              char(3) NOT NULL DEFAULT 'PEN',
  nombre_pagador      bytea,                          -- cifrado
  nombre_busqueda     varchar(200),                   -- normalizado, para búsqueda
  codigo_seguridad    varchar(16),
  estado_yallego      estado_cobro_ylg NOT NULL,
  ocurrido_at         timestamptz NOT NULL,
  origen              origen_cobro NOT NULL,
  recibido_at         timestamptz NOT NULL DEFAULT now(),
  actualizado_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conexion_id, yallego_id)
);

CREATE INDEX yallego_cobros_candidatos
  ON yallego_cobros (local_id, ocurrido_at DESC)
  WHERE estado_yallego = 'CAPTURED';
CREATE INDEX yallego_cobros_busqueda
  ON yallego_cobros USING gin (nombre_busqueda gin_trgm_ops);

CREATE TABLE yallego_eventos (            -- bandeja de entrada idempotente
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  conexion_id   uuid NOT NULL REFERENCES yallego_conexiones(id) ON DELETE CASCADE,
  event_id      uuid NOT NULL,
  tipo          varchar(40) NOT NULL,
  cuerpo        jsonb NOT NULL,
  recibido_at   timestamptz NOT NULL DEFAULT now(),
  procesado_at  timestamptz,
  intentos      smallint NOT NULL DEFAULT 0,
  error         varchar(300),
  UNIQUE (conexion_id, event_id)
);

CREATE TABLE incidencias_cobros (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  local_id      uuid NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  estado        estado_cobros_local NOT NULL,
  inicio_at     timestamptz NOT NULL,
  fin_at        timestamptz,
  avisado_at    timestamptz                     -- correo al OWNER (RF-COB-005)
);

CREATE INDEX incidencias_abiertas ON incidencias_cobros (local_id) WHERE fin_at IS NULL;
```

### 3.10. Auditoría y outbox

```sql
CREATE TABLE auditoria (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  local_id      uuid,
  accion        varchar(60) NOT NULL,          -- pagos.constancia, pedidos.cancelado_pagado…
  actor_tipo    varchar(16) NOT NULL CHECK (actor_tipo IN ('USUARIO', 'PANTALLA', 'SISTEMA', 'PLATAFORMA')),
  actor_id      uuid,
  recurso_tipo  varchar(40) NOT NULL,
  recurso_id    uuid,
  datos         jsonb NOT NULL DEFAULT '{}',
  ip            inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auditoria_negocio_fecha ON auditoria (tenant_id, created_at DESC);

CREATE TABLE outbox_eventos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  tipo          varchar(60) NOT NULL,
  carga         jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  publicado_at  timestamptz,
  lease_hasta   timestamptz
);

CREATE INDEX outbox_pendientes ON outbox_eventos (id) WHERE publicado_at IS NULL;
```

### 3.11. Plataforma

```sql
CREATE TABLE administradores_plataforma (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          citext NOT NULL UNIQUE,
  nombre         varchar(80) NOT NULL,
  password_hash  text NOT NULL,
  totp_secreto   bytea,
  activo         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE suscripciones (            -- activación manual en el MVP (RF-PLT-004)
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  plan          varchar(32) NOT NULL,
  locales_max   smallint NOT NULL,
  vigente_desde date NOT NULL,
  vigente_hasta date NOT NULL,
  nota          varchar(300),
  creada_por    uuid REFERENCES administradores_plataforma(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

---

## 4. Row Level Security

### 4.1. Activación

Todas las tablas con `tenant_id` tienen RLS activo y forzado:

```sql
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos FORCE ROW LEVEL SECURITY;
```

### 4.2. Política estándar

```sql
CREATE POLICY aislamiento_negocio ON pedidos
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
```

Sin `app.tenant_id` la consulta no devuelve filas: la política niega por omisión.

### 4.3. Aplicación desde el backend

```typescript
prisma.withTenant(tenantId, async (tx) => {
  // set_config('app.tenant_id', tenantId, true) al inicio de la transacción
});
```

Igual que en Yallegó: el contexto vive lo que dura la transacción.

### 4.4. Excepciones sin tenant

Usan `withoutTenantScope` y están enumeradas en el código:

| Caso                                   | Por qué                                                |
| -------------------------------------- | ------------------------------------------------------ |
| Ingreso y renovación de sesión         | Aún no se conoce el negocio activo                     |
| Solicitudes de vinculación de pantallas | No tienen negocio hasta que un ADMIN las aprueba      |
| Recepción de webhook por token de URL  | El token identifica la conexión y su negocio           |
| Jobs del worker que recorren negocios  | Listan conexiones activas y luego trabajan con `withTenant` |
| Consola de plataforma                  | Rol de base de datos con `BYPASSRLS`, solo `/platform/v1` |

### 4.5. Refuerzos de la migración inicial

| Refuerzo | Motivo |
| --- | --- |
| `negocios` también tiene RLS, con `id = app_current_tenant()` | Un negocio no ve los datos de otro ni siquiera en su propia fila |
| `membresia_locales` referencia `(membresia_id, tenant_id)` y `(local_id, tenant_id)` | Una clave foránea no respeta RLS: sin esto, una membresía de un negocio podría apuntar a un local de otro |
| `auditoria` solo tiene políticas de lectura e inserción | La aplicación no puede modificarla ni borrarla (`07_SEGURIDAD_AUTH.md` §10); la purga por retención usa un rol con `BYPASSRLS` |

La suite `apps/api/test/aislamiento` comprueba todo esto con el rol de la aplicación,
incluido que cada tabla con `tenant_id` tenga RLS activado y forzado.

---

## 5. Datos semilla

### 5.1. Negocio de demostración (solo desarrollo y staging)

| Elemento   | Valor                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| Negocio    | «Cevichería Demo»                                                                         |
| Locales    | «Centro» y «Norte»                                                                        |
| Usuarios   | `dueno@demo.test` (OWNER), `admin@demo.test` (ADMIN), `caja1@demo.test` y `caja2@demo.test` (CAJERO), `mesera1@demo.test` (MESERO) |
| Categorías | Ceviches, Combinados, Platos de fondo, Bebidas, Adicionales                               |
| Productos  | Ceviche de pescado (S/ 25.00), Chicharrón de pescado (S/ 28.00), Chicharrón de pota (S/ 22.00), Jalea mixta (S/ 38.00), Arroz con mariscos (S/ 30.00), Coca-Cola personal (S/ 4.00, sin cocina), Inca Kola personal (S/ 4.00, sin cocina), Chicha morada 1 L (S/ 10.00, sin cocina), Canchita adicional (S/ 3.00) |
| Combos     | «Mixto» (S/ 32.00): ceviche de pescado + chicharrón de pota. «Trío marino» (S/ 42.00): ceviche + chicharrón de pescado + arroz con mariscos |
| Táper      | S/ 1.00 por plato para llevar; S/ 0.00 en bebidas                                         |
| Zonas      | Patio de comida (1er piso) y Terraza (2do piso). Sin números de mesa (D12)                 |
| Yallegó    | Conexión contra el simulador con dos celulares: «Yape Centro» y «Yape Norte»              |

Las contraseñas de los usuarios de demostración se definen en `.env.example`
(`SEED_PASSWORD`), nunca en el código.

---

## 6. Uso de Redis

| Clave o uso                           | Contenido                                              | Vida      |
| ------------------------------------- | ------------------------------------------------------ | --------- |
| `idem:{tenant}:{usuario}:{clave}`     | Respuesta de una solicitud idempotente                 | 24 h      |
| `cobros:estado:{local}`               | Estado de cobros calculado, para lecturas rápidas      | 2 min     |
| `rl:{alcance}:{id}`                   | Contadores de límite de solicitudes                    | 1 min     |
| Adaptador de Socket.io                | Publicación entre instancias de la API                 | —         |
| Colas BullMQ                          | `yallego-eventos`, `yallego-consulta`, `yallego-confirmacion`, `cobros-estado`, `conciliacion`, `outbox`, `correos` | — |

Redis no es fuente de verdad: si se pierde, el sistema se reconstruye desde PostgreSQL.

---

## 7. Retención

| Datos                                    | Retención                                       |
| ---------------------------------------- | ----------------------------------------------- |
| Pedidos, ítems, pagos y turnos            | 5 años (respaldo contable)                      |
| Nombre del pagador en `yallego_cobros`    | 90 días; luego se borra y queda el resto del cobro |
| Nombre de la constancia en `pagos`        | 90 días; luego queda solo la inicial            |
| `yallego_eventos`                         | 30 días                                         |
| `outbox_eventos` publicados               | 7 días                                          |
| `auditoria`                               | 2 años                                          |
| `incidencias_cobros`                      | 1 año                                           |

Sujeto a revisión legal (Ley 29733 y obligaciones tributarias).

---

## 8. Evolución del esquema

- Migraciones con Prisma Migrate, una por cambio, revisadas en el PR.
- Cambios que bloquean tablas grandes (`pedidos`, `pagos`) se hacen en dos pasos:
  columna nueva nullable → relleno por lotes → restricción.
- Particionar `pedidos`, `pagos` y `yallego_cobros` por mes cuando superen 20
  millones de filas.
