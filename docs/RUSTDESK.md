# RustDesk Deployment Notes

Date drafted: 2026-04-10
Last updated: 2026-07-06

## Scope

This document captures the recommended way to run a self-hosted RustDesk OSS server on the SimpleHost platform.

The intended fit is:

- `SimpleHost Agent` owns the node-local execution through `container.reconcile`
- RustDesk runs as two Quadlet-managed containers: `hbbs` and `hbbr`
- the service runs on the primary and secondary nodes with shared trusted key material
- the stable public hostname stays independent from node-specific failover targets
- the public web splash is exposed by Apache at `https://rustdesk.pyrosa.com.do/`

## Live status on 2026-07-06

The current SimpleHostMan runtime reports both managed RustDesk nodes healthy:

- stable public hostname: `rustdesk.pyrosa.com.do`
- primary target: `rustdesk1.pyrosa.com.do` / `51.222.204.86`
- secondary target: `rustdesk2.pyrosa.com.do` / `51.222.206.196`
- public connection page: `https://rustdesk.pyrosa.com.do/connect`
- public TXT reference: `_rustdesk.pyrosa.com.do`
- shared public key source: `/srv/containers/rustdesk/data/id_ed25519.pub`
- services: `rustdesk-hbbs.service` and `rustdesk-hbbr.service`
- containers: `rustdesk-hbbs` and `rustdesk-hbbr`
- image: `docker.io/rustdesk/rustdesk-server:1.1.14`

Apache owns a small public web surface for the stable RustDesk hostname:

- `https://rustdesk.pyrosa.com.do/` renders a splash-only landing page
- `https://rustdesk.pyrosa.com.do/connect` renders the public client connection values
- the source-controlled vhost is [`/opt/simplehostman/src/platform/httpd/vhosts/rustdesk-public.conf`](/opt/simplehostman/src/platform/httpd/vhosts/rustdesk-public.conf)
- the vhost preserves `Host: rustdesk.pyrosa.com.do` and proxies to the local SimpleHostMan web runtime on `127.0.0.1:3200`
- the legacy operator-port path `https://vps-prd.pyrosa.com.do:3200/connect/rustdesk` is no longer the canonical public route

The public web surface separates the splash-only landing page from the connection helper. RustDesk transport still uses the native `hbbs` and `hbbr` listeners directly; do not put the RustDesk transport ports behind Apache or Authentik.

## Baseline ports

Upstream RustDesk documentation currently recommends running `hbbs` and `hbbr` in containers and opening these ports for the OSS server:

- `21115/tcp`
- `21116/tcp`
- `21116/udp`
- `21117/tcp`

Optional upstream ports:

- `21118/tcp` for web client support
- `21119/tcp` for web client support
- `21114/tcp` for the Pro web console

The SimpleHost baseline does not open those ports by default. Use the optional firewalld service artifact in:

- [`/opt/simplehostman/src/platform/host/firewalld/services/rustdesk-oss.xml`](/opt/simplehostman/src/platform/host/firewalld/services/rustdesk-oss.xml)

Verified upstream references on 2026-04-10:

- https://rustdesk.com/docs/en/self-host/rustdesk-server-oss/docker/
- https://rustdesk.com/docs/en/self-host/client-configuration/

The pinned image tag in the example Quadlet units is `docker.io/rustdesk/rustdesk-server:1.1.14`, chosen to avoid drifting `latest` tags in product-owned artifacts.

## Recommended host layout

- shared data: `/srv/containers/rustdesk/data`
- Quadlet units: `/etc/containers/systemd/rustdesk-hbbs.container` and `/etc/containers/systemd/rustdesk-hbbr.container`
- optional env files: `/etc/containers/systemd/env/*.env`

RustDesk stores the public key in the shared data directory after the first `hbbs` start:

- `/srv/containers/rustdesk/data/id_ed25519.pub`

That key is what clients need for encrypted self-hosted connections.

## Recommended deployment model

Use host networking for both containers.

Why:

- it matches the upstream guidance for Linux
- it avoids extra port-mapping complexity
- it keeps the real client IP visible to RustDesk

For first rollout on a new pair, start on the primary node and only enable the secondary after:

- DNS and routing for the chosen RustDesk hostname are settled
- the same shared key material is available on the secondary
- a failover playbook is documented and tested

## Example `container.reconcile` payloads

`hbbs`:

```json
{
  "serviceName": "rustdesk-hbbs",
  "containerName": "rustdesk-hbbs",
  "image": "docker.io/rustdesk/rustdesk-server:1.1.14",
  "description": "RustDesk ID and rendezvous service",
  "exec": "hbbs",
  "network": "host",
  "hostDirectories": [
    "/srv/containers/rustdesk/data"
  ],
  "volumes": [
    "/srv/containers/rustdesk/data:/root:Z"
  ],
  "enable": true,
  "start": true
}
```

`hbbr`:

```json
{
  "serviceName": "rustdesk-hbbr",
  "containerName": "rustdesk-hbbr",
  "image": "docker.io/rustdesk/rustdesk-server:1.1.14",
  "description": "RustDesk relay service",
  "exec": "hbbr",
  "network": "host",
  "hostDirectories": [
    "/srv/containers/rustdesk/data"
  ],
  "volumes": [
    "/srv/containers/rustdesk/data:/root:Z"
  ],
  "enable": true,
  "start": true
}
```

Matching source-controlled Quadlet examples live in:

- [`/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbs.container`](/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbs.container)
- [`/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbr.container`](/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbr.container)

## Firewall activation

Install the optional service definition and attach it to the `public` zone only on nodes that should expose RustDesk publicly.

Example:

```bash
install -D -m 0644 \
  /opt/simplehostman/src/platform/host/firewalld/services/rustdesk-oss.xml \
  /etc/firewalld/services/rustdesk-oss.xml
firewall-cmd --permanent --zone=public --add-service=rustdesk-oss
firewall-cmd --reload
```

If web client support is needed later, add `21118/tcp` and `21119/tcp` deliberately instead of widening the default service upfront.

## Client configuration

For OSS clients, set:

- `ID Server`: `rustdesk.pyrosa.com.do`
- `Key`: the contents of `id_ed25519.pub`
- `Relay Server`: `rustdesk.pyrosa.com.do`

The public helper page at `https://rustdesk.pyrosa.com.do/connect` displays these values and the TXT reference generated by SimpleHostMan.

## Operational notes

- Treat RustDesk transport as an edge service, not as an Apache-proxied web app.
- Keep the public hostname explicit and stable: `rustdesk.pyrosa.com.do`.
- Keep `https://rustdesk.pyrosa.com.do/` claimed by a dedicated Apache vhost so it never falls through to the default public vhost.
- Back up `/srv/containers/rustdesk/data` because it contains the server key material clients trust.
- Do not open RustDesk ports on unrelated nodes; expose them only where the service is intended to run.
- For controlled failover, sync `/srv/containers/rustdesk/data/` in full before moving the stable hostname between `rustdesk1.pyrosa.com.do` and `rustdesk2.pyrosa.com.do`.
