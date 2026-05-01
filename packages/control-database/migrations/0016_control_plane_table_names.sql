DO $$
DECLARE
  rename_pair TEXT[];
  rename_pairs TEXT[][] := ARRAY[
    ARRAY['control_plane_node_credentials', 'control_plane_agent_node_credentials'],
    ARRAY['control_plane_nodes', 'control_plane_agent_nodes'],
    ARRAY['shp_apps', 'control_plane_apps'],
    ARRAY['shp_audit_events', 'control_plane_audit_events'],
    ARRAY['shp_backup_policies', 'control_plane_backup_policies'],
    ARRAY['shp_backup_runs', 'control_plane_backup_runs'],
    ARRAY['shp_database_credentials', 'control_plane_database_credentials'],
    ARRAY['shp_databases', 'control_plane_databases'],
    ARRAY['shp_dns_records', 'control_plane_dns_records'],
    ARRAY['shp_dns_zones', 'control_plane_dns_zones'],
    ARRAY['shp_environment_parameters', 'control_plane_environment_parameters'],
    ARRAY['shp_inventory_import_runs', 'control_plane_inventory_import_runs'],
    ARRAY['shp_mail_aliases', 'control_plane_mail_aliases'],
    ARRAY['shp_mail_domains', 'control_plane_mail_domains'],
    ARRAY['shp_mail_policy', 'control_plane_mail_policy'],
    ARRAY['shp_mailbox_credential_reveals', 'control_plane_mailbox_credential_reveals'],
    ARRAY['shp_mailbox_credentials', 'control_plane_mailbox_credentials'],
    ARRAY['shp_mailbox_quotas', 'control_plane_mailbox_quotas'],
    ARRAY['shp_mailboxes', 'control_plane_mailboxes'],
    ARRAY['shp_memberships', 'control_plane_memberships'],
    ARRAY['shp_node_installed_packages', 'control_plane_node_installed_packages'],
    ARRAY['shp_nodes', 'control_plane_nodes'],
    ARRAY['shp_reconciliation_runs', 'control_plane_reconciliation_runs'],
    ARRAY['shp_schema_migrations', 'control_plane_schema_migrations'],
    ARRAY['shp_sessions', 'control_plane_sessions'],
    ARRAY['shp_sites', 'control_plane_sites'],
    ARRAY['shp_tenants', 'control_plane_tenants'],
    ARRAY['shp_user_credentials', 'control_plane_user_credentials'],
    ARRAY['shp_user_global_roles', 'control_plane_user_global_roles'],
    ARRAY['shp_users', 'control_plane_users']
  ];
  index_record RECORD;
  constraint_record RECORD;
  new_name TEXT;
BEGIN
  FOREACH rename_pair SLICE 1 IN ARRAY rename_pairs LOOP
    IF to_regclass(format('public.%I', rename_pair[1])) IS NOT NULL
       AND to_regclass(format('public.%I', rename_pair[2])) IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', rename_pair[1], rename_pair[2]);
    END IF;
  END LOOP;

  FOR index_record IN
    SELECT index_class.relname
    FROM pg_class index_class
    INNER JOIN pg_namespace namespace
      ON namespace.oid = index_class.relnamespace
    WHERE namespace.nspname = 'public'
      AND index_class.relkind IN ('i', 'I')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_entry
        WHERE constraint_entry.conindid = index_class.oid
      )
      AND (
        index_class.relname LIKE 'shp\_%' ESCAPE '\'
        OR index_class.relname LIKE 'control_plane_node_credentials%'
        OR index_class.relname LIKE 'control_plane_nodes%'
      )
  LOOP
    IF index_record.relname LIKE 'shp\_%' ESCAPE '\' THEN
      new_name := regexp_replace(index_record.relname, '^shp_', 'control_plane_');
    ELSIF index_record.relname LIKE 'control_plane_node_credentials%' THEN
      new_name := regexp_replace(
        index_record.relname,
        '^control_plane_node_credentials',
        'control_plane_agent_node_credentials'
      );
    ELSIF index_record.relname LIKE 'control_plane_nodes%' THEN
      new_name := regexp_replace(
        index_record.relname,
        '^control_plane_nodes',
        'control_plane_agent_nodes'
      );
    ELSE
      new_name := index_record.relname;
    END IF;

    IF new_name <> index_record.relname
       AND to_regclass(format('public.%I', new_name)) IS NULL THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', index_record.relname, new_name);
    END IF;
  END LOOP;

  FOR constraint_record IN
    SELECT
      constraint_namespace.nspname AS schema_name,
      table_class.relname AS table_name,
      constraint_entry.conname AS constraint_name
    FROM pg_constraint constraint_entry
    INNER JOIN pg_class table_class
      ON table_class.oid = constraint_entry.conrelid
    INNER JOIN pg_namespace constraint_namespace
      ON constraint_namespace.oid = table_class.relnamespace
    WHERE constraint_namespace.nspname = 'public'
      AND (
        constraint_entry.conname LIKE 'shp\_%' ESCAPE '\'
        OR constraint_entry.conname LIKE 'control_plane_node_credentials%'
        OR constraint_entry.conname LIKE 'control_plane_nodes%'
      )
  LOOP
    IF constraint_record.constraint_name LIKE 'shp\_%' ESCAPE '\' THEN
      new_name := regexp_replace(constraint_record.constraint_name, '^shp_', 'control_plane_');
    ELSIF constraint_record.constraint_name LIKE 'control_plane_node_credentials%' THEN
      new_name := regexp_replace(
        constraint_record.constraint_name,
        '^control_plane_node_credentials',
        'control_plane_agent_node_credentials'
      );
    ELSIF constraint_record.constraint_name LIKE 'control_plane_nodes%' THEN
      new_name := regexp_replace(
        constraint_record.constraint_name,
        '^control_plane_nodes',
        'control_plane_agent_nodes'
      );
    ELSE
      new_name := constraint_record.constraint_name;
    END IF;

    IF new_name <> constraint_record.constraint_name THEN
      EXECUTE format(
        'ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',
        constraint_record.table_name,
        constraint_record.constraint_name,
        new_name
      );
    END IF;
  END LOOP;
END $$;
