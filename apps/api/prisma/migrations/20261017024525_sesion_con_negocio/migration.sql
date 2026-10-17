-- Negocio activo de cada sesión, para emitir el access token al renovar
-- (docs/07_SEGURIDAD_AUTH.md §2.1). La tabla todavía no tiene filas en ningún
-- ambiente, así que la columna nace NOT NULL sin valor por defecto.

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "tenant_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "refresh_tokens_familia_id_idx" ON "refresh_tokens"("familia_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- La tabla ahora tiene tenant_id: entra en Row Level Security como las demás.
-- El ingreso, la renovación y el cierre la leen con withoutTenantScope
-- (docs/05_MODELO_DATOS.md §4.4).
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_negocio ON "refresh_tokens" FOR ALL
  USING (app_is_unscoped() OR "tenant_id" = app_current_tenant())
  WITH CHECK (app_is_unscoped() OR "tenant_id" = app_current_tenant());
