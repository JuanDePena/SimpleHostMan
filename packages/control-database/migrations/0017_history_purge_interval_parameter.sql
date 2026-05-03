INSERT INTO control_plane_environment_parameters (
  parameter_key,
  parameter_value,
  description,
  is_sensitive,
  created_from_ui
)
VALUES (
  'SIMPLEHOST_HISTORY_PURGE_INTERVAL_DAYS',
  '1',
  'Minimum interval in days between automatic worker purges of old audit, reconciliation and job history rows.',
  false,
  true
)
ON CONFLICT (parameter_key) DO NOTHING;
