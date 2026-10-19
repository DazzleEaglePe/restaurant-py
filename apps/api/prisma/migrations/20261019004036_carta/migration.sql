-- Carta del negocio (docs/05_MODELO_DATOS.md §3.4, Sprint 2): categorías,
-- productos, platos fijos de los combos y disponibilidad por local. Las claves
-- compuestas (id, tenant_id) impiden mezclar filas de dos negocios aunque se
-- conozcan los ids. Los grupos de opciones (RF-CAR-004, COULD) no se crean.

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "orden" SMALLINT NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(300),
    "precio" DECIMAL(10,2) NOT NULL,
    "costo_taper" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "foto_url" TEXT,
    "es_combo" BOOLEAN NOT NULL DEFAULT false,
    "requiere_cocina" BOOLEAN NOT NULL DEFAULT true,
    "orden" SMALLINT NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_componentes" (
    "combo_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cantidad" SMALLINT NOT NULL DEFAULT 1,

    CONSTRAINT "combo_componentes_pkey" PRIMARY KEY ("combo_id","producto_id")
);

-- CreateTable
CREATE TABLE "producto_locales" (
    "producto_id" UUID NOT NULL,
    "local_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "agotado" BOOLEAN NOT NULL DEFAULT false,
    "precio_local" DECIMAL(10,2),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_locales_pkey" PRIMARY KEY ("producto_id","local_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_tenant_id_nombre_key" ON "categorias"("tenant_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_id_tenant_id_key" ON "categorias"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "productos_tenant_id_categoria_id_orden_idx" ON "productos"("tenant_id", "categoria_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "productos_tenant_id_nombre_key" ON "productos"("tenant_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_id_tenant_id_key" ON "productos"("id", "tenant_id");

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_tenant_id_fkey" FOREIGN KEY ("categoria_id", "tenant_id") REFERENCES "categorias"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_componentes" ADD CONSTRAINT "combo_componentes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_componentes" ADD CONSTRAINT "combo_componentes_combo_id_tenant_id_fkey" FOREIGN KEY ("combo_id", "tenant_id") REFERENCES "productos"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_componentes" ADD CONSTRAINT "combo_componentes_producto_id_tenant_id_fkey" FOREIGN KEY ("producto_id", "tenant_id") REFERENCES "productos"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_locales" ADD CONSTRAINT "producto_locales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_locales" ADD CONSTRAINT "producto_locales_producto_id_tenant_id_fkey" FOREIGN KEY ("producto_id", "tenant_id") REFERENCES "productos"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_locales" ADD CONSTRAINT "producto_locales_local_id_tenant_id_fkey" FOREIGN KEY ("local_id", "tenant_id") REFERENCES "locales"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restricciones que Prisma no modela
-- ---------------------------------------------------------------------------

ALTER TABLE "productos"
  ADD CONSTRAINT "productos_precio_check" CHECK ("precio" >= 0),
  ADD CONSTRAINT "productos_costo_taper_check" CHECK ("costo_taper" >= 0);

ALTER TABLE "combo_componentes"
  ADD CONSTRAINT "combo_componentes_cantidad_check" CHECK ("cantidad" > 0),
  ADD CONSTRAINT "combo_componentes_no_si_mismo_check" CHECK ("combo_id" <> "producto_id");

ALTER TABLE "producto_locales"
  ADD CONSTRAINT "producto_locales_precio_local_check" CHECK ("precio_local" >= 0);

-- ---------------------------------------------------------------------------
-- Row Level Security (docs/05_MODELO_DATOS.md §4.2)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['categorias', 'productos', 'combo_componentes', 'producto_locales']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabla);
    EXECUTE format(
      'CREATE POLICY aislamiento_negocio ON %I FOR ALL'
      || ' USING (app_is_unscoped() OR tenant_id = app_current_tenant())'
      || ' WITH CHECK (app_is_unscoped() OR tenant_id = app_current_tenant())',
      tabla
    );
  END LOOP;
END
$$;
