# Repository Publishing Runbook

Date drafted: `2026-05-01`

## Scope

This runbook defines the managed publication workflow for
`repos.pyrosa.com.do`, currently used as the SLES/YUM RPM repository for
Proyecto Iohana packages.

The live repository root is:

- `/srv/containers/apps/pyrosa-repos/app/sbotools`

The public validation URLs are:

- `https://repos.pyrosa.com.do/sbotools/sbotools.repo`
- `https://repos.pyrosa.com.do/sbotools/RPM-GPG-KEY-sbotools`
- `https://repos.pyrosa.com.do/sbotools/repodata/repomd.xml`
- `https://repos.pyrosa.com.do/sbotools/repodata/repomd.xml.asc`

## Current State

`repos.pyrosa.com.do` is a preserved static repository. No active cron,
worker, or cPanel-era publishing job should be revived. New RPM publication
must be explicit, auditable, and reversible.

Latest observed package and metadata timestamp during the phase 4 review:

- `iohana-1.0-260410B.x86_64.rpm`
- repository metadata timestamp: `2026-04-10 16:03 UTC`

## Publication Policy

Owner:

- Proyecto Iohana release operator

Trigger:

- an approved new Iohana RPM build that is ready for SLES clients

Inputs:

- signed RPM artifact
- expected SHA-256 checksum
- changelog or release note
- confirmation that package consumers can tolerate a repository metadata refresh

Repository update rule:

- stage new RPMs outside the served `sbotools` tree
- verify checksum and package metadata before touching the public tree
- copy RPMs into `sbotools/x86_64`
- regenerate repository metadata with the existing repository toolchain
- sign refreshed metadata
- publish metadata atomically, with the old `repodata` kept until validation
  passes

Validation checklist:

- `sbotools.repo` returns `200 OK`
- `RPM-GPG-KEY-sbotools` returns `200 OK` and `text/plain`
- `repodata/repomd.xml` returns `200 OK` and `application/xml`
- `repodata/repomd.xml.asc` returns `200 OK` and
  `application/pgp-signature`
- new RPM URL returns `200 OK` and `application/x-rpm`
- primary and secondary forced HTTPS checks pass for all repository metadata
- at least one SLES-compatible client refreshes metadata successfully

Rollback:

- restore the previous `repodata` directory and remove the new RPM from
  `sbotools/x86_64`
- re-run the validation checklist
- keep the failed staged artifact and checksum outside the served tree for
  postmortem review

## Do Not Do

- do not re-enable old `vps-old` cron jobs
- do not publish from inside the app container
- do not overwrite repository metadata before checksum and signature validation
- do not remove older RPMs without a separate retention decision for client
  rollback compatibility
