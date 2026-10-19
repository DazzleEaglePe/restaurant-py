-- Zonas de cada local (docs/05_MODELO_DATOS.md §3.5, Sprint 2): dónde se
-- sentará el cliente que come aquí. Sin mesas numeradas (D12). La clave compuesta
-- (local_id, tenant_id) impide una zona de A en un local de B.

-- CreateTable
CREATE TABLE "zonas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "local_id" UUID NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "piso" VARCHAR(20),
    "orden" SMALLINT NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zonas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zonas_local_id_nombre_key" ON "zonas"("local_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_id_tenant_id_key" ON "zonas"("id", "tenant_id");

-- AddForeignKey
ALTER TABLE "zonas" ADD CONSTRAINT "zonas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas" ADD CONSTRAINT "zonas_local_id_tenant_id_fkey" FOREIGN KEY ("local_id", "tenant_id") REFERENCES "locales"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Row Level Security (docs/05_MODELO_DATOS.md §4.2)
-- ---------------------------------------------------------------------------

ALTER TABLE "zonas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "zonas" FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_negocio ON "zonas" FOR ALL
  USING (app_is_unscoped() OR "tenant_id" = app_current_tenant())
  WITH CHECK (app_is_unscoped() OR "tenant_id" = app_current_tenant());
