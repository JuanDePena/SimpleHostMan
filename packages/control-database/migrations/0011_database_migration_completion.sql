ALTER TABLE shp_databases
  ADD COLUMN IF NOT EXISTS migration_completed_from TEXT;

ALTER TABLE shp_databases
  ADD COLUMN IF NOT EXISTS migration_completed_at TIMESTAMPTZ;
