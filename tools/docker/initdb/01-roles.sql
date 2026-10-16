-- Roles de conexión (docs/05_MODELO_DATOS.md §4 y docs/11_ESTRUCTURA_PROYECTO.md §12.1).
--
-- resto_app: el de la aplicación. No es propietario de las tablas ni tiene
-- BYPASSRLS, así que Row Level Security siempre lo alcanza.
-- resto_plataforma: solo para la consola de plataforma (/platform/v1), que
-- necesita ver todos los negocios.
--
-- Las migraciones y la semilla corren con el rol propietario (`resto`).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'resto_app') THEN
    CREATE ROLE resto_app LOGIN PASSWORD 'resto_app_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'resto_plataforma') THEN
    CREATE ROLE resto_plataforma LOGIN BYPASSRLS PASSWORD 'resto_plataforma_dev';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE resto TO resto_app, resto_plataforma;
GRANT USAGE ON SCHEMA public TO resto_app, resto_plataforma;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO resto_app, resto_plataforma;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO resto_app, resto_plataforma;

-- Las tablas de migraciones futuras quedan accesibles sin repetir el GRANT.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO resto_app, resto_plataforma;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO resto_app, resto_plataforma;
