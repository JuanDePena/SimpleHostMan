CREATE TABLE IF NOT EXISTS shp_node_installed_packages (
  node_id TEXT NOT NULL REFERENCES control_plane_nodes(node_id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  epoch TEXT,
  version TEXT NOT NULL,
  release TEXT NOT NULL,
  arch TEXT NOT NULL,
  nevra TEXT NOT NULL,
  source TEXT,
  installed_at TIMESTAMPTZ,
  last_collected_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (node_id, package_name, arch)
);

CREATE INDEX IF NOT EXISTS shp_node_installed_packages_name_idx
  ON shp_node_installed_packages (package_name, node_id, arch);

CREATE INDEX IF NOT EXISTS shp_node_installed_packages_collected_idx
  ON shp_node_installed_packages (node_id, last_collected_at DESC);
