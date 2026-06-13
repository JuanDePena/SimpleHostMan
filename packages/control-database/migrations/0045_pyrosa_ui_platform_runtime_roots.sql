UPDATE control_plane_apps
SET
  storage_root = '/srv/containers/apps/pyrosa-ui/runtime',
  updated_at = NOW()
WHERE slug = 'pyrosa-ui';

UPDATE control_plane_apps
SET
  storage_root = '/srv/containers/apps/pyrosa-platform/runtime',
  updated_at = NOW()
WHERE slug = 'pyrosa-platform';
