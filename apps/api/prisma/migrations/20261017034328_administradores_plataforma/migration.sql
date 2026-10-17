-- CreateTable
CREATE TABLE "administradores_plataforma" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secreto" BYTEA NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administradores_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "administradores_plataforma_email_key" ON "administradores_plataforma"("email");

-- docs/07_SEGURIDAD_AUTH.md §11: la aplicación no debe ver estas cuentas. RLS
-- activado y forzado sin ninguna política niega todo a resto_app; el rol de
-- plataforma tiene BYPASSRLS y es el único que la lee.
ALTER TABLE "administradores_plataforma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "administradores_plataforma" FORCE ROW LEVEL SECURITY;
