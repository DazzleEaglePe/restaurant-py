# resto

Sistema multi-tenant de pedidos para restaurantes que cobran antes de cocinar:
caja en el celular, pago con Yape verificado por Yallegó o en efectivo, pantalla de
cocina y pantalla de pedidos listos para los clientes.

> `resto` es el nombre de trabajo; el nombre comercial está por definir.

## Estado

Sprint 1 en curso (16 – 30 oct. 2026). La documentación funcional y técnica está en
[docs/README.md](./docs/README.md) y el plan en
[docs/10_PLAN_DESARROLLO.md](./docs/10_PLAN_DESARROLLO.md). Cada sprint es un hito de
GitHub con sus issues.

## Puesta en marcha

Requiere Node.js 22, Corepack y Docker.

```bash
corepack enable
pnpm install
cp .env.example .env
./tools/scripts/generate-keys.sh >> .env
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev:stack
```

- Web: http://localhost:4000
- API: http://localhost:4001/v1/health
- Correos de desarrollo (Mailpit): http://localhost:8026
- Usuarios de la «Cevichería Demo»: `dueno@demo.test`, `admin@demo.test`, `caja1@demo.test`,
  `caja2@demo.test` y `mesera1@demo.test`, con la contraseña `SEED_PASSWORD` de tu `.env`.

Antes de abrir un PR: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
Con Docker levantado, `pnpm test:aislamiento` corre la suite de aislamiento entre negocios.

## Convenciones

- Ramas: `feat/<descripcion>`, `fix/<descripcion>`, `chore/<descripcion>` y `docs/<descripcion>`.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) con ámbito cuando corresponda; por ejemplo, `feat(pagos): confirmar cobro con reserva local`.
