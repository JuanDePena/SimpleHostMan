UPDATE control_plane_backup_policies
SET
  retention_days = 7,
  replica_retention_days = 7,
  updated_at = NOW()
WHERE policy_slug = 'db-pyrosa-sync-daily'
  AND target_node_id = 'primary'
  AND storage_location = '/srv/backups/databases/pyrosa-sync';
