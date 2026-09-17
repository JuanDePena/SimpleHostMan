import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {setTimeout} from 'node:timers/promises';

// Disposable, networkless PostgreSQL. Does not consume production credentials.
const name='simplehost-documents-test-'+randomUUID();
const sql=readFileSync(new URL('../../packages/control-database/migrations/0051_pyrosa_documents_managed_catalog.sql',import.meta.url),'utf8');
const run=(args,input)=>execFileSync('podman',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000});
const query=sql=>run(['exec','-i',name,'psql','-U','postgres','-XAt','-v','ON_ERROR_STOP=1'],sql).trim();
let created=false;
try {
  run(['run','--detach','--rm','--name',name,'--network','none','--memory','512m',
    '--tmpfs','/var/lib/postgresql:rw,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','docker.io/library/postgres:18-alpine']);created=true;
  let ready=false;
  for(let n=0;n<80;n++) {try {query('SELECT 1');ready=true;break;}catch {await setTimeout(250);}}
  assert.ok(ready,'isolated_postgres_not_ready');
  query(`
    CREATE TABLE control_plane_apps(app_id text PRIMARY KEY, tenant_id text, zone_id text,
      primary_node_id text, standby_node_id text, slug text UNIQUE, runtime_image text,
      backend_port int UNIQUE, storage_root text, mode text, created_at timestamptz, updated_at timestamptz);
    CREATE TABLE control_plane_sites(site_id text PRIMARY KEY,app_id text REFERENCES control_plane_apps,
      canonical_domain text UNIQUE,aliases jsonb,created_at timestamptz,updated_at timestamptz);
    CREATE TABLE control_plane_databases(database_id text PRIMARY KEY,app_id text REFERENCES control_plane_apps,
      primary_node_id text,standby_node_id text,engine text,database_name text,database_user text,
      pending_migration_to text,migration_completed_from text,migration_completed_at timestamptz,
      created_at timestamptz,updated_at timestamptz,UNIQUE(engine,database_name));
    CREATE TABLE control_plane_database_credentials(database_id text PRIMARY KEY REFERENCES control_plane_databases);
    CREATE TABLE control_plane_backup_policies(policy_id text PRIMARY KEY,tenant_id text,target_node_id text,
      policy_slug text UNIQUE,schedule text,retention_days int,replica_retention_days int,
      storage_location text,resource_selectors jsonb,created_at timestamptz,updated_at timestamptz);
    CREATE TABLE control_plane_audit_events(event_id text PRIMARY KEY,actor_type text,actor_id text,
      event_type text,entity_type text,entity_id text,payload jsonb,occurred_at timestamptz);
  `);
  query('BEGIN;'+sql+'COMMIT;');
  const snapshot=()=>query(`SELECT jsonb_build_object('app',(SELECT jsonb_agg(a) FROM control_plane_apps a),
    'db',(SELECT jsonb_agg(d) FROM control_plane_databases d),'site',(SELECT jsonb_agg(s) FROM control_plane_sites s),
    'policies',(SELECT jsonb_agg(p ORDER BY policy_slug) FROM control_plane_backup_policies p),
    'audit',(SELECT jsonb_agg(e) FROM control_plane_audit_events e));`);
  const before=snapshot(),state=JSON.parse(before);
  assert.equal(state.app.length,1);assert.equal(state.db.length,1);assert.equal(state.site.length,1);
  assert.equal(state.app[0].mode,'metadata-only');assert.equal(state.db[0].database_user,'app_pyrosa_documents_service');
  assert.equal(state.policies.length,2);assert.equal(state.audit.length,1);
  assert.equal(query('SELECT count(*) FROM control_plane_database_credentials'),'0');
  query('BEGIN;'+sql+'COMMIT;');assert.equal(snapshot(),before,'replay_changed_catalog');
  const mutations=[
    "UPDATE control_plane_apps SET mode='active-passive'",
    "UPDATE control_plane_apps SET backend_port=12345",
    "UPDATE control_plane_sites SET aliases='[\"other.example\"]'",
    "UPDATE control_plane_databases SET database_user='other_role'",
    "INSERT INTO control_plane_database_credentials VALUES ('database-pyrosa-documents')",
    "UPDATE control_plane_backup_policies SET replica_retention_days=14",
    "UPDATE control_plane_backup_policies SET resource_selectors='[\"app-files:other\"]'"
  ];
  for(const mutation of mutations) {
    assert.throws(()=>query('BEGIN;'+mutation+';'+sql+'COMMIT;'),/Command failed/);
    assert.equal(snapshot(),before,'conflict_did_not_rollback');
  }
  console.log(JSON.stringify({ok:true,isolatedPostgres:true,replayUnchanged:true,negativeCases:mutations.length,
    appCount:1,databaseCount:1,policies:2,liveChanges:false}));
} finally {if(created) run(['stop','--time','2',name]);}
