UPDATE control_plane_apps
SET
  runtime_image = 'docker.io/library/node:22-bookworm-slim',
  storage_root = '/srv/containers/apps/pyrosa-ui/app',
  updated_at = NOW()
WHERE slug = 'pyrosa-ui';

UPDATE control_plane_apps
SET
  runtime_image = 'docker.io/library/node:22-bookworm-slim',
  storage_root = '/srv/containers/apps/pyrosa-platform/app',
  updated_at = NOW()
WHERE slug = 'pyrosa-platform';
