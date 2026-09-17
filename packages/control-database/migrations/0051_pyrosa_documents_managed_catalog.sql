-- Adopt the existing Documents runtime as metadata-only. Never reconcile its
-- proxy, container, passwords or physical application schemas from this record.
-- Execute with the normal transactional SimpleHostMan migration owner.
SELECT pg_advisory_xact_lock(hashtextextended('simplehost:pyrosa-documents:catalog', 0));

INSERT INTO control_plane_apps
  (app_id, tenant_id, zone_id, primary_node_id, standby_node_id, slug,
   runtime_image, backend_port, storage_root, mode, created_at, updated_at)
VALUES
  ('app-pyrosa-documents', 'tenant-pyrosa', 'zone-pyrosa.com.do', 'primary', NULL,
   'pyrosa-documents',
   'docker.io/library/node@sha256:d415caac2f1f77b98caaf9415c5f807e14bc8d7bdea62561ea2fef4fbd08a73c',
   10180, '/srv/containers/apps/pyrosa-documents', 'metadata-only', NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO control_plane_sites
  (site_id, app_id, canonical_domain, aliases, created_at, updated_at)
VALUES ('site-pyrosa-documents', 'app-pyrosa-documents',
        'documents.pyrosa.com.do', '[]'::jsonb, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO control_plane_databases
  (database_id, app_id, primary_node_id, standby_node_id, engine,
   database_name, database_user, pending_migration_to,
   migration_completed_from, migration_completed_at, created_at, updated_at)
VALUES ('database-pyrosa-documents', 'app-pyrosa-documents', 'primary', NULL,
        'postgresql', 'app_pyrosa_documents', 'app_pyrosa_documents_service',
        NULL, NULL, NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Inherit the existing Pyrosa posture: 14 local days, 1 replica day.
-- Minutes align with the backup runner's five-minute cadence. Cron is UTC.
INSERT INTO control_plane_backup_policies
  (policy_id, tenant_id, target_node_id, policy_slug, schedule, retention_days,
   replica_retention_days, storage_location, resource_selectors, created_at, updated_at)
VALUES
  ('backup-policy-pyrosa-documents-database-daily', 'tenant-pyrosa', 'primary',
   'pyrosa-documents-database-daily', '10 3 * * *', 14, 1,
   '/srv/backups/databases/pyrosa-documents',
   '["database:app_pyrosa_documents"]'::jsonb, NOW(), NOW()),
  ('backup-policy-pyrosa-documents-files-daily', 'tenant-pyrosa', 'primary',
   'pyrosa-documents-files-daily', '20 3 * * *', 14, 1,
   '/srv/backups/apps/pyrosa-documents',
   '["app-files:pyrosa-documents"]'::jsonb, NOW(), NOW())
ON CONFLICT DO NOTHING;

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM control_plane_apps WHERE app_id='app-pyrosa-documents'
      AND slug='pyrosa-documents' AND tenant_id='tenant-pyrosa'
      AND zone_id='zone-pyrosa.com.do' AND primary_node_id='primary'
      AND standby_node_id IS NULL AND mode='metadata-only' AND backend_port=10180
      AND storage_root='/srv/containers/apps/pyrosa-documents'
      AND runtime_image='docker.io/library/node@sha256:d415caac2f1f77b98caaf9415c5f807e14bc8d7bdea62561ea2fef4fbd08a73c'
  ) OR NOT EXISTS (
    SELECT 1 FROM control_plane_sites WHERE site_id='site-pyrosa-documents'
      AND app_id='app-pyrosa-documents' AND canonical_domain='documents.pyrosa.com.do'
      AND aliases='[]'::jsonb
  ) OR NOT EXISTS (
    SELECT 1 FROM control_plane_databases WHERE database_id='database-pyrosa-documents'
      AND app_id='app-pyrosa-documents' AND primary_node_id='primary'
      AND standby_node_id IS NULL AND engine='postgresql'
      AND database_name='app_pyrosa_documents'
      AND database_user='app_pyrosa_documents_service'
      AND pending_migration_to IS NULL AND migration_completed_from IS NULL
      AND migration_completed_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM control_plane_database_credentials WHERE database_id='database-pyrosa-documents'
  ) THEN RAISE EXCEPTION 'documents_catalog_conflict'; END IF;

  IF (SELECT count(*) FROM control_plane_backup_policies p
    JOIN (VALUES
      ('pyrosa-documents-database-daily','10 3 * * *',
       '/srv/backups/databases/pyrosa-documents','["database:app_pyrosa_documents"]'::jsonb),
      ('pyrosa-documents-files-daily','20 3 * * *',
       '/srv/backups/apps/pyrosa-documents','["app-files:pyrosa-documents"]'::jsonb)
    ) e(slug,schedule,location,selectors)
    ON p.policy_slug=e.slug AND p.policy_id='backup-policy-'||e.slug
    WHERE p.tenant_id='tenant-pyrosa' AND p.target_node_id='primary'
      AND p.schedule=e.schedule AND p.storage_location=e.location
      AND p.resource_selectors=e.selectors
      AND p.retention_days=14 AND p.replica_retention_days=1) <> 2
  THEN RAISE EXCEPTION 'documents_backup_policy_conflict'; END IF;
END
$guard$;

INSERT INTO control_plane_audit_events
  (event_id, actor_type, actor_id, event_type, entity_type, entity_id, payload, occurred_at)
VALUES ('audit-pyrosa-documents-catalog-0051', 'system', 'migration:0051',
        'app.catalog.adopted', 'app', 'app-pyrosa-documents',
        '{"mode":"metadata-only","database":"app_pyrosa_documents","backupPolicies":["pyrosa-documents-database-daily","pyrosa-documents-files-daily"],"runtimeModified":false,"applicationDdl":false,"credentialsCopied":false}'::jsonb,
        NOW())
ON CONFLICT DO NOTHING;
