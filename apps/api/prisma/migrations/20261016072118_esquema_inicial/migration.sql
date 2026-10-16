-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "estado_negocio" AS ENUM ('ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('OWNER', 'ADMIN', 'CAJERO', 'MESERO');

-- CreateEnum
CREATE TYPE "estado_cobros_local" AS ENUM ('ACTIVO', 'DEMORADO', 'DESCONECTADO', 'SIN_SERVICIO', 'CONEXION_INVALIDA', 'SIN_CELULAR');

-- CreateTable
CREATE TABLE "negocios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_comercial" VARCHAR(120) NOT NULL,
    "razon_social" VARCHAR(160),
    "ruc" CHAR(11),
    "zona_horaria" VARCHAR(64) NOT NULL DEFAULT 'America/Lima',
    "logo_url" TEXT,
    "color_acento" CHAR(7),
    "estado" "estado_negocio" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negocios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "direccion" VARCHAR(200),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ventana_pagos_min" SMALLINT NOT NULL DEFAULT 15,
    "permite_constancia" BOOLEAN NOT NULL DEFAULT true,
    "monto_max_constancia" DECIMAL(10,2),
    "mesa_obligatoria" BOOLEAN NOT NULL DEFAULT false,
    "cocina_alerta_min" SMALLINT NOT NULL DEFAULT 10,
    "cocina_critico_min" SMALLINT NOT NULL DEFAULT 20,
    "ocultar_listos_min" SMALLINT NOT NULL DEFAULT 10,
    "tiempo_base_min" SMALLINT NOT NULL DEFAULT 20,
    "costo_taper_defecto" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "estado_cobros" "estado_cobros_local" NOT NULL DEFAULT 'SIN_CELULAR',
    "estado_cobros_desde" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "password_hash" TEXT,
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membresias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol" "rol_usuario" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membresias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membresia_locales" (
    "membresia_id" UUID NOT NULL,
    "local_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "membresia_locales_pkey" PRIMARY KEY ("membresia_id","local_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "familia_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_at" TIMESTAMPTZ(6) NOT NULL,
    "usado_at" TIMESTAMPTZ(6),
    "revocado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_un_uso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "proposito" VARCHAR(24) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_at" TIMESTAMPTZ(6) NOT NULL,
    "usado_at" TIMESTAMPTZ(6),

    CONSTRAINT "tokens_un_uso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "local_id" UUID,
    "accion" VARCHAR(60) NOT NULL,
    "actor_tipo" VARCHAR(16) NOT NULL,
    "actor_id" UUID,
    "recurso_tipo" VARCHAR(40) NOT NULL,
    "recurso_id" UUID,
    "datos" JSONB NOT NULL DEFAULT '{}',
    "ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locales_tenant_id_nombre_key" ON "locales"("tenant_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "locales_id_tenant_id_key" ON "locales"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "membresias_tenant_id_usuario_id_key" ON "membresias"("tenant_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "membresias_id_tenant_id_key" ON "membresias"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_un_uso_token_hash_key" ON "tokens_un_uso"("token_hash");

-- CreateIndex
CREATE INDEX "auditoria_negocio_fecha" ON "auditoria"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "locales" ADD CONSTRAINT "locales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresia_locales" ADD CONSTRAINT "membresia_locales_membresia_id_tenant_id_fkey" FOREIGN KEY ("membresia_id", "tenant_id") REFERENCES "membresias"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresia_locales" ADD CONSTRAINT "membresia_locales_local_id_tenant_id_fkey" FOREIGN KEY ("local_id", "tenant_id") REFERENCES "locales"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresia_locales" ADD CONSTRAINT "membresia_locales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_un_uso" ADD CONSTRAINT "tokens_un_uso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restricciones que Prisma no modela (docs/05_MODELO_DATOS.md §3.2 y §3.10)
-- ---------------------------------------------------------------------------

ALTER TABLE "locales"
  ADD CONSTRAINT "locales_ventana_pagos_min_check" CHECK ("ventana_pagos_min" BETWEEN 5 AND 60);

ALTER TABLE "tokens_un_uso"
  ADD CONSTRAINT "tokens_un_uso_proposito_check" CHECK ("proposito" IN ('INVITACION', 'RECUPERACION'));

ALTER TABLE "auditoria"
  ADD CONSTRAINT "auditoria_actor_tipo_check"
  CHECK ("actor_tipo" IN ('USUARIO', 'PANTALLA', 'SISTEMA', 'PLATAFORMA'));

-- ---------------------------------------------------------------------------
-- Row Level Security (docs/05_MODELO_DATOS.md §4)
-- ---------------------------------------------------------------------------

-- Negocio activo de la transacción. NULL si no se fijó: las políticas niegan
-- por omisión.
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

-- Operación sin negocio, solo para las excepciones de §4.4 (`withoutTenantScope`).
-- Se fija con set_config(..., true): no sobrevive a la transacción.
CREATE OR REPLACE FUNCTION app_is_unscoped() RETURNS boolean
  LANGUAGE sql
  STABLE
  AS $$ SELECT coalesce(nullif(current_setting('app.unscoped', true), ''), 'off') = 'on' $$;

-- FORCE hace que las políticas apliquen también al propietario de las tablas.
DO $$
DECLARE
  tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['negocios', 'locales', 'membresias', 'membresia_locales', 'auditoria']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabla);
  END LOOP;

  FOREACH tabla IN ARRAY ARRAY['locales', 'membresias', 'membresia_locales']
  LOOP
    EXECUTE format(
      'CREATE POLICY aislamiento_negocio ON %I FOR ALL'
      || ' USING (app_is_unscoped() OR tenant_id = app_current_tenant())'
      || ' WITH CHECK (app_is_unscoped() OR tenant_id = app_current_tenant())',
      tabla
    );
  END LOOP;
END
$$;

-- `negocios` no tiene tenant_id: su propio id es el negocio.
CREATE POLICY aislamiento_negocio ON "negocios" FOR ALL
  USING (app_is_unscoped() OR "id" = app_current_tenant())
  WITH CHECK (app_is_unscoped() OR "id" = app_current_tenant());

-- docs/07_SEGURIDAD_AUTH.md §10: la aplicación no modifica ni borra la
-- auditoría. Sin políticas de UPDATE ni DELETE, esas órdenes no alcanzan
-- ninguna fila; la purga por retención la hace un rol con BYPASSRLS.
CREATE POLICY auditoria_lectura ON "auditoria" FOR SELECT
  USING (app_is_unscoped() OR "tenant_id" = app_current_tenant());
CREATE POLICY auditoria_registro ON "auditoria" FOR INSERT
  WITH CHECK (app_is_unscoped() OR "tenant_id" = app_current_tenant());
