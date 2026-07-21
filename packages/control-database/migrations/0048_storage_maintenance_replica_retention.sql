ALTER TABLE control_plane_backup_policies
  ADD COLUMN IF NOT EXISTS replica_retention_days INTEGER;

ALTER TABLE control_plane_backup_policies
  DROP CONSTRAINT IF EXISTS control_plane_backup_policies_replica_retention_days_check;

ALTER TABLE control_plane_backup_policies
  ADD CONSTRAINT control_plane_backup_policies_replica_retention_days_check
  CHECK (replica_retention_days IS NULL OR replica_retention_days > 0);

UPDATE control_plane_backup_policies
SET
  retention_days = 7,
  replica_retention_days = 14,
  updated_at = NOW()
WHERE policy_slug = 'db-pyrosa-sync-daily'
  AND target_node_id = 'primary'
  AND storage_location = '/srv/backups/databases/pyrosa-sync';
