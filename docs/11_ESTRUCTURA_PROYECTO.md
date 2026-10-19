# 11 — Estructura del Proyecto

> Versiones de herramientas y librerías alineadas con Yallegó al 2026-10-11, para
> compartir conocimiento, configuración y paquetes.

---

## 1. Justificación del monorepo

Un solo repositorio con pnpm y Turborepo, igual que Yallegó:

- API, web y consola de plataforma comparten contratos (`zod`), dominio y tokens.
- Un cambio en un contrato rompe la compilación de quien lo usa, en el mismo PR.
- La CI compila y prueba solo lo afectado.

Yallegó queda en **su propio repositorio**. Este proyecto lo consume solo por HTTP
(`04_ARQUITECTURA_SOFTWARE.md` ADR-01 y ADR-02).

---

## 2. Estructura de directorios

```
restaurant-proy/
├── apps/
│   ├── api/                      # NestJS: API, webhooks, Socket.io y worker
│   ├── web/                      # Next.js: caja, cocina, pantalla pública y administración
│   └── plataforma/               # Next.js: consola interna
├── packages/
│   ├── contracts/                # Esquemas zod y tipos de la API propia
│   ├── dominio/                  # Reglas puras: estados, totales, emparejamiento, conciliación
│   ├── yallego-client/           # Cliente tipado de la API pública de Yallegó + firma
│   ├── api-client/               # Cliente HTTP y de socket para las apps web
│   ├── design-tokens/            # Tokens → CSS variables y preset de Tailwind
│   ├── ui/                       # Componentes compartidos (shadcn/ui)
│   ├── config-eslint/
│   └── config-typescript/
├── tools/
│   ├── docker/                   # docker-compose local, Dockerfiles, proxy
│   ├── yallego-simulador/        # Imitación de la API de Yallegó para desarrollo y CI
│   └── scripts/                  # Generación de claves, utilidades
├── docs/                         # Esta documentación
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## 3. `apps/api` — Backend

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts                   # Proceso api
│   ├── worker.ts                 # Proceso worker
│   ├── app.module.ts
│   ├── worker.module.ts
│   ├── config/                   # Esquema de variables de entorno (zod)
│   ├── infrastructure/
│   │   ├── database/             # PrismaService, withTenant, withoutTenantScope
│   │   ├── cache/                # Redis
│   │   ├── queue/                # BullMQ: colas y productores
│   │   ├── crypto/               # AES-256-GCM, hashing
│   │   ├── events/               # Outbox y relay
│   │   ├── realtime/             # Adaptador Socket.io + Redis
│   │   ├── storage/              # Fotos de la carta (S3 compatible)
│   │   ├── mailer/
│   │   └── observability/        # Métricas, logs, health
│   ├── shared/                   # Guardas, decoradores, errores, idempotencia
│   └── modules/
│       ├── auth/
│       ├── negocios/
│       ├── usuarios/
│       ├── pantallas/
│       ├── carta/
│       ├── mesas/
│       ├── pedidos/
│       ├── pagos/
│       ├── caja/
│       ├── yallego/
│       ├── cobros/
│       ├── conciliacion/
│       ├── tiempo-real/
│       ├── reportes/
│       ├── auditoria/
│       └── plataforma/
└── test/
    ├── aislamiento/              # Suite de aislamiento entre negocios
    └── e2e/                      # Flujos contra el simulador de Yallegó
```

### 3.1. Convención de módulos

Módulos simples (carta, mesas, usuarios):

```
modules/carta/
├── carta.module.ts
├── carta.controller.ts
├── carta.service.ts
└── carta.service.spec.ts
```

Módulos con reglas de negocio no triviales (`pedidos`, `pagos`, `yallego`,
`cobros`, `conciliacion`) separan aplicación e infraestructura; las reglas puras
viven en `packages/dominio`:

```
modules/pagos/
├── pagos.module.ts
├── pagos.controller.ts
├── application/
│   ├── confirmar-pago-billetera.ts       # Caso de uso (04 §5.2)
│   ├── registrar-pago-efectivo.ts
│   ├── registrar-pago-constancia.ts
│   └── listar-candidatos.ts
├── ports/
│   └── proveedor-billetera.port.ts       # Interfaz ProveedorBilletera (04 §3.1)
├── jobs/
│   └── reintentar-confirmacion.processor.ts
└── *.spec.ts

modules/yallego/
├── yallego.module.ts
├── conexion.controller.ts
├── webhooks.controller.ts                # Cuerpo crudo, firma, bandeja
├── adapters/
│   ├── yallego-http.adapter.ts           # Implementa ProveedorBilletera
│   └── yallego-memoria.adapter.ts        # Pruebas unitarias
├── jobs/
│   ├── procesar-evento.processor.ts
│   ├── consulta-respaldo.processor.ts
│   └── estado-celulares.processor.ts
└── *.spec.ts
```

---

## 4. `apps/web` — Caja, cocina, pantalla pública y administración

```
apps/web/
├── public/
│   ├── manifest.webmanifest      # PWA de la caja (start_url: /caja)
│   ├── sonidos/
│   └── iconos/
└── src/
    ├── app/
    │   ├── (auth)/ingresar/ · activar/ · recuperar/
    │   ├── (caja)/caja/          # Layout móvil, navegación Inicio · Pedidos
    │   │   ├── page.tsx          # Inicio (carta)
    │   │   ├── pedido/           # Pedido en armado y cobro
    │   │   ├── pedidos/
    │   │   └── turno/
    │   ├── (salon)/salon/        # Mesera: pedidos para mesa
    │   ├── (cocina)/cocina/      # Pantalla completa horizontal
    │   ├── (pantalla)/pantalla/  # Pantalla pública
    │   ├── elegir-local/         # Quien opera en varios locales elige el de hoy
    │   ├── sin-local/            # Cajera o mesera todavía sin local asignado
    │   ├── sesion-vencida/       # «Tu sesión terminó» (09 §15)
    │   ├── vincular/             # La pantalla muestra su código y QR y espera la aprobación
    │   └── (admin)/admin/        # Escritorio: inicio con la lista de arranque,
    │                             #   carta y su vista previa, locales/[id],
    │                             #   equipo y negocio
    ├── features/
    │   ├── carta/
    │   ├── pedido-en-armado/
    │   ├── cobro/
    │   ├── cobros-estado/
    │   ├── salon/
    │   ├── observaciones/
    │   ├── cocina/
    │   ├── pantalla-publica/
    │   ├── turno/
    │   └── admin/…
    ├── lib/                      # Sesión, carga de datos, mensajes de error, socket, sonidos
    └── sw.ts                     # Service worker (Serwist)
```

### 4.1. Estructura de una feature

```
features/cobro/
├── components/                   # CobroCandidatoCard, DetallePago, TecladoEfectivo
├── hooks/                        # useCandidatos, useConfirmarPago
├── api.ts                        # Llamadas vía packages/api-client
└── *.test.tsx
```

Cada superficie importa solo sus features; un import de `admin` desde `pantalla`
falla en lint (`eslint-plugin-boundaries`).

---

## 5. `apps/plataforma` — Consola interna

Next.js aparte, desplegada en otro dominio con lista de IPs. Alta de negocios,
estado de Yallegó y cobros por negocio, suspensión y suscripciones.

```
apps/plataforma/src/
├── app/
│   ├── ingresar/                 # Correo, contraseña y código TOTP
│   └── negocios/                 # Lista, alta con invitación al OWNER, suspender y reactivar
└── lib/                          # Sesión en memoria (30 min, sin renovación) y mensajes
```

Usa `ClientePlataforma` de `packages/api-client`: el token vive solo en memoria y
no viaja ninguna cookie. Al recargar la página o a los 30 minutos se vuelve a
ingresar. La API admite su origen (`PLATAFORMA_URL`) solo en `/platform/v1` y sin
credenciales; la web, solo en `/v1`.

---

## 6. Paquetes compartidos

### 6.1. `packages/contracts`

Esquemas `zod` de cada solicitud y respuesta de la API propia, eventos del socket
y proyecciones. La API valida con ellos y la web tipa con ellos.

### 6.2. `packages/dominio`

Sin dependencias de framework. Probado con cobertura ≥ 90 %.

| Archivo                  | Contenido                                                           |
| ------------------------ | ------------------------------------------------------------------- |
| `pedido-estados.ts`      | Transiciones permitidas y quién puede hacerlas                      |
| `totales.ts`             | Total de ítems y táperes, saldo, vuelto                          |
| `emparejamiento.ts`      | Orden de candidatos, preselección, ambigüedad (04 §5.1)             |
| `conciliacion.ts`        | Reglas de conciliación de constancias (04 §5.6)                     |
| `estado-cobros.ts`       | Cálculo del estado del local a partir de sus celulares (04 §5.5)    |
| `turno.ts`               | Efectivo esperado y diferencia                                      |
| `tiempo-espera.ts`       | Tiempo de espera sugerido (04 §5.10)                                |
| `correccion.ts`          | Crédito, diferencia y devolución de una corrección (04 §5.11)       |
| `descuentos.ts`          | Orden de descuentos, cortesías y táper (04 §5.12)                   |
| `dinero.ts`              | Aritmética de soles sin coma flotante                               |

### 6.3. `packages/yallego-client`

Cliente de la API pública de Yallegó, escrito como cualquier integrador lo haría.
Candidato a convertirse en el SDK oficial de Node de Yallegó.

| Exporta                       | Uso                                                     |
| ----------------------------- | ------------------------------------------------------- |
| `YallegoClient`               | Métodos tipados por recurso, timeout, `Retry-After`     |
| `verificarFirmaWebhook()`     | Firma, ventana de 5 min, firma anterior en rotación     |
| Tipos de eventos              | `transaction.*`, `device.*`                             |
| Errores tipados               | `YallegoConflictError`, `YallegoAuthError`, …           |

### 6.4. `packages/api-client`

Cliente HTTP con renovación automática del access token, `Idempotency-Key` y
cliente de Socket.io con reconexión y resincronización.

El access token vive solo en memoria. Ante un `401`, el cliente renueva una única vez
aunque haya varias solicitudes en vuelo: dos renovaciones con la misma cookie
revocarían la sesión por reutilización (RF-AUTH-002).

### 6.5. `packages/design-tokens` y `packages/ui`

Mismo esquema que Yallegó. Los valores de marca se completan con la línea gráfica
(`09_DESIGN_SYSTEM.md`).

### 6.6. Paquetes de configuración

`config-eslint` y `config-typescript`, copiados de Yallegó y ajustados.

---

## 7. `tools/yallego-simulador`

Servidor pequeño (Fastify) que imita la parte de la API de Yallegó que usa este
proyecto. Habilita desarrollo y CI sin yapear de verdad (brecha Y5).

| Imita                                              | Comportamiento                                                |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `GET /v1/transactions`, `GET /v1/transactions/{id}` | Cobros en memoria                                            |
| `POST /v1/transactions/{id}/confirm`               | `200`, `409` si ya está confirmado                            |
| `GET /v1/devices`                                  | Celulares con conectividad controlable                        |
| `POST /v1/webhooks`, `/test`, `DELETE`             | Registra la URL y firma igual que Yallegó                     |

Controles para pruebas (`/simulador/*` y una página web en
`http://localhost:4010`):

- **Simular Yape:** monto, nombre, celular → crea el cobro y envía el webhook firmado.
- **Apagar o encender un celular** → cambia su conectividad.
- **Modo lento** (respuestas de 8 s) y **modo caído** (`503`).
- **Cortar webhooks** → solo la consulta de respaldo trae los cobros.
- **Entrega atrasada** → envía un cobro con `occurred_at` antiguo.

---

## 8. Configuración raíz

### 8.1. `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'
```

### 8.2. `package.json`

```json
{
  "name": "resto",
  "private": true,
  "packageManager": "pnpm@11.28.0",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "dev:stack": "turbo run dev --filter=@resto/api --filter=@resto/web --filter=@resto/yallego-simulador",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "pnpm --filter @resto/api test:e2e",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:generate": "pnpm --filter @resto/api db:generate",
    "db:migrate": "pnpm --filter @resto/api db:migrate",
    "db:seed": "pnpm --filter @resto/api db:seed",
    "docker:up": "docker compose -f tools/docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f tools/docker/docker-compose.yml down"
  },
  "devDependencies": {
    "@commitlint/cli": "20.2.0",
    "@commitlint/config-conventional": "20.2.0",
    "prettier": "3.9.6",
    "turbo": "2.10.12",
    "typescript": "5.9.3"
  }
}
```

### 8.3. `turbo.json`

Igual que el de Yallegó, con las variables propias en `env`
(`DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`,
`NEXT_PUBLIC_APP_NAME`, `YALLEGO_BASE_URL`).

### 8.4. Versiones principales

| Librería               | Versión  |
| ---------------------- | -------- |
| Node.js                | 22       |
| TypeScript             | 5.9.3    |
| NestJS                 | 11.2.3   |
| Prisma                 | 6.19.3   |
| BullMQ                 | 6.x      |
| Socket.io              | 4.8.x    |
| zod                    | 4.4.3    |
| Next.js                | 15.5.27  |
| React                  | 19.1.0   |
| TanStack Query         | 5.x      |
| Tailwind CSS           | 3.4.19   |
| Vitest                 | 3.2.7    |

---

## 9. Entorno de desarrollo local

### 9.1. Puertos

Distintos a los de Yallegó, para correr ambos proyectos a la vez:

| Servicio                 | Puerto |
| ------------------------ | ------ |
| Web (caja, cocina, pantalla, admin) | 4000 |
| API                      | 4001   |
| Consola de plataforma    | 4002   |
| Simulador de Yallegó     | 4010   |
| PostgreSQL               | 5433   |
| Redis                    | 6380   |
| Mailpit (SMTP / web)     | 1026 / 8026 |
| MinIO (API / consola)    | 9100 / 9101 |

### 9.2. `tools/docker/docker-compose.yml`

PostgreSQL 16, Redis 7 y Mailpit, con los puertos de §9.1 y volúmenes
persistentes. MinIO dejó de publicar sus imágenes gratuitas en Docker Hub: el
almacenamiento compatible con S3 para las fotos de la carta se elige en el Sprint 2,
que es cuando se necesita. El simulador corre con `pnpm dev:stack`, no en Docker, para
recargarlo al editarlo.

### 9.3. Puesta en marcha

```bash
corepack enable
corepack pnpm install
cp .env.example .env
./tools/scripts/generate-keys.sh >> .env
corepack pnpm docker:up
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev:stack
```

Luego:

- Caja: `http://localhost:4000/caja` con `caja1@demo.test`.
- Salón: `http://localhost:4000/salon` con `mesera1@demo.test`.
- Cocina y pantalla pública: abrir `http://localhost:4000/vincular` en otra ventana y
  aprobar su código en `http://localhost:4000/admin/pantallas/vincular`.
- Consola de plataforma: `http://localhost:4002`, con un administrador creado con
  `PLATAFORMA_PASSWORD='…' corepack pnpm --filter @resto/api plataforma:crear-admin --email … --nombre …`
  y su secreto TOTP en una app de autenticación.
- Simular un Yape: `http://localhost:4010`.

### 9.4. Probar con Yallegó real

El webhook de Yallegó no acepta `localhost` (brecha Y7). Para probar con un celular
y un Yape real:

1. Levantar un túnel HTTPS hacia el puerto 4001 (por ejemplo, Cloudflare Tunnel).
2. Definir `PUBLIC_API_URL` con la URL del túnel y `YALLEGO_BASE_URL` con la API de
   Yallegó (staging o la local de Yallegó en `http://localhost:3001/v1`).
3. Conectar Yallegó desde la administración con una clave de prueba.

---

## 10. Convenciones

### 10.1. Idioma

| Elemento                                   | Idioma                                     |
| ------------------------------------------ | ------------------------------------------ |
| Términos de dominio (clases, tablas, rutas, campos) | Español: `Pedido`, `pagos`, `/v1/pedidos`, `fecha_operacion` |
| Términos técnicos (sufijos y patrones)     | Inglés: `PedidosService`, `pagos.controller.ts`, `*.processor.ts` |
| Comentarios y documentación                | Español                                    |
| Términos de Yallegó dentro del adaptador   | Los de Yallegó (`transaction`, `device`)   |

### 10.2. Nomenclatura de paquetes

`@resto/<nombre>` (nombre de trabajo; se renombra con P1).

### 10.3. Nomenclatura de archivos

`kebab-case` para archivos; componentes React en `PascalCase`.

### 10.4. Ramas

`feat/<descripcion>`, `fix/<descripcion>`, `chore/<descripcion>`, `docs/<descripcion>`.

### 10.5. Mensajes de commit

Conventional Commits con ámbito: `feat(pagos): confirmar cobro con reserva local`.

---

## 11. Integración y despliegue continuos

| Etapa              | Qué corre                                                                 |
| ------------------ | ------------------------------------------------------------------------- |
| Cada PR            | Formato, lint, typecheck, pruebas unitarias, suite de aislamiento, e2e contra el simulador, build, gitleaks, auditoría de dependencias |
| Rama principal     | Lo anterior + imágenes Docker etiquetadas con el commit                   |
| Despliegue         | Manual a staging; a producción fuera de hora punta (RNF-DISP-008)         |

---

## 12. Variables de entorno

### 12.1. API y worker

| Variable                 | Ejemplo                                    | Descripción                                     |
| ------------------------ | ------------------------------------------ | ----------------------------------------------- |
| `DATABASE_URL`           | `postgresql://resto:resto@localhost:5433/resto` | Conexión de la aplicación (sujeta a RLS)   |
| `DATABASE_PLATFORM_URL`  | `postgresql://resto_plataforma:…@…/resto`  | Rol con `BYPASSRLS` para `/platform/v1`         |
| `REDIS_URL`              | `redis://localhost:6380`                   |                                                 |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | (generadas)                    | RS256                                           |
| `ENCRYPTION_KEY`         | (32 bytes en base64)                       | Cifrado de credenciales de Yallegó y nombres    |
| `PUBLIC_API_URL`         | `https://api.<dominio>`                    | Base de la URL del webhook que se registra en Yallegó |
| `YALLEGO_BASE_URL`       | `http://localhost:4010/v1`                 | Simulador en local; `https://api.yallego.app/v1` en producción |
| `YALLEGO_TIMEOUT_MS`     | `5000`                                     |                                                 |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | MinIO en local | Fotos de la carta                   |
| `SMTP_URL`               | `smtp://localhost:1026`                    |                                                 |
| `WEB_URL`                | `http://localhost:4000`                    | Enlaces en correos y QR de vinculación          |
| `PLATAFORMA_URL`         | `http://localhost:4002`                    | Origen de la consola: CORS de `/platform/v1`    |
| `PLATAFORMA_IPS`         | `10.8.0.0/24`                              | IPs o subredes que abren la consola (docs/07 §11) |
| `SEED_PASSWORD`          | (solo desarrollo)                          | Contraseña de los usuarios de demostración      |

### 12.2. Web y plataforma

| Variable               | Ejemplo                    |
| ---------------------- | -------------------------- |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:4001`    |
| `NEXT_PUBLIC_WS_URL`   | `ws://localhost:4001`      |
| `NEXT_PUBLIC_APP_NAME` | Nombre comercial (P1)      |

---

## 13. Secuencia de creación del proyecto

1. `git init`, `.gitignore`, `.editorconfig`, Prettier, commitlint, gitleaks.
2. `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`.
3. `packages/config-typescript` y `packages/config-eslint` (desde Yallegó).
4. `tools/docker/docker-compose.yml` y `.env.example`.
5. `apps/api` con NestJS, Prisma, `withTenant`, health y métricas.
6. `packages/contracts` y `packages/dominio` con sus pruebas.
7. `apps/web` con Next.js, Tailwind, `packages/design-tokens` y `packages/ui`.
8. CI en `.github/workflows/ci.yml`.
9. Primer PR: el entregable del Sprint 1 (`10_PLAN_DESARROLLO.md` §3).
