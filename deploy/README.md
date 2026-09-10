# Production deployment

This guide deploys one Inbox Point instance for one organization. It is
not a multi-tenant deployment: each additional organization gets a separate
Compose project, data volume, `.env`, host port, backup directory, domain, and
monitor.

## Topology and trust boundary

- **RU application server:** Docker Compose, application and admin UI, SQLite
  and adjacent state files, VK access, Caddy, and the external-backup mount.
- **Foreign egress VPS:** WireGuard and a minimal Tinyproxy process. It is only
  a transport path to `api.telegram.org`; it has no application, database,
  Telegram bot token, VK token, administrator password, or backup.
- **Independent monitor host:** checks the public HTTPS `/ready` endpoint and
  sends alerts through a webhook that does not depend on Telegram.

Only Telegram Bot API requests use `TELEGRAM_PROXY_URL`. The application does
not set a global `HTTP_PROXY` or `HTTPS_PROXY`; VK, readiness checks, backup
alerts, and other HTTP traffic keep their normal direct route.

## 1. Prepare WireGuard

Install WireGuard on both servers and generate a separate private/public key
pair on each host. Never commit real `.conf` files or keys. Copy
`wireguard/ru.conf.example` to `/etc/wireguard/wg0.conf` on the RU server and
`wireguard/egress.conf.example` to the same path on the egress VPS, then replace
all placeholders.

Protect and start the configurations:

```bash
sudo chmod 600 /etc/wireguard/wg0.conf
sudo systemctl enable --now wg-quick@wg0
sudo wg show
ping -c 3 10.77.0.2       # from RU
ping -c 3 10.77.0.1       # from egress
```

The `/32` `AllowedIPs` entries route only the peer address. The egress host does
not need IP forwarding or NAT because Tinyproxy terminates the connection.

## 2. Run the Telegram egress proxy

On the foreign VPS, install Tinyproxy from the operating-system repository.
Copy the templates and service:

```bash
sudo install -m 0644 deploy/tinyproxy/inbox-point.conf.example /etc/tinyproxy/inbox-point.conf
sudo install -m 0644 deploy/tinyproxy/telegram-domains.example /etc/tinyproxy/inbox-point-telegram-domains
sudo install -m 0644 deploy/systemd/inbox-point-telegram-egress.service /etc/systemd/system/inbox-point-telegram-egress.service
sudo systemctl daemon-reload
sudo systemctl enable --now inbox-point-telegram-egress
sudo systemctl status inbox-point-telegram-egress
```

The proxy listens only on `10.77.0.2:8888`, accepts only `10.77.0.1`, permits
only HTTPS CONNECT on port 443, and denies hosts other than
`api.telegram.org`. Proxy authentication is intentionally omitted: WireGuard
peer authentication, private-interface binding, the client ACL, host allowlist,
and firewall form the access boundary.

From the RU server, validate both the allow and deny paths:

```bash
curl --proxy http://10.77.0.2:8888 --head https://api.telegram.org
curl --proxy http://10.77.0.2:8888 --head https://example.com   # must fail
```

`systemctl is-active inbox-point-telegram-egress` is the local process
health check. The first `curl` also verifies WireGuard, CONNECT, DNS on the
egress host, TLS reachability, and the destination allowlist.

## 3. Firewall policy

Keep provider firewalls and host firewalls aligned. Example UFW intent (adapt
SSH source ranges before applying it):

RU application server:

```bash
sudo ufw default deny incoming
sudo ufw allow from <ADMIN_IP_OR_CIDR> to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Do not allow the Compose host port (`3101` by default): it is bound to loopback
and is reached only by Caddy. If outbound traffic is restricted, allow UDP to
the egress VPS on port 51820, direct HTTPS for VK and alert webhooks, and DNS/NTP
required by the host.

Foreign egress VPS:

```bash
sudo ufw default deny incoming
sudo ufw allow from <ADMIN_IP_OR_CIDR> to any port 22 proto tcp
sudo ufw allow from <RU_PUBLIC_IP> to any port 51820 proto udp
sudo ufw allow in on wg0 from 10.77.0.1 to 10.77.0.2 port 8888 proto tcp
sudo ufw enable
```

Never expose TCP 8888 on the public interface. The proxy needs outbound DNS and
TCP 443 only.

## 4. Configure the application instance

On the RU server, check out a pinned release under `/opt/inbox-point`, copy
`.env.example` to `.env`, restrict it to the deployment account, and set at
least:

```dotenv
INSTANCE_ID=organization-a
NODE_ENV=production
ADMIN_PASSWORD=<LONG_RANDOM_PASSWORD>
HOST_PORT=3101
APP_NETWORK_SUBNET=172.30.1.0/24
APP_NETWORK_GATEWAY=172.30.1.1
TELEGRAM_PROXY_URL=http://10.77.0.2:8888
BACKUP_HOST_PATH=/srv/backups/inbox-point/organization-a
BACKUP_EXPORT_PATH=/srv/backups/inbox-point/organization-a
```

Set channel credentials in `.env` or connect them later through the protected
UI. The proxy URL contains no bot token. `INSTANCE_ID` is an operational label
used in logs, alerts, snapshot metadata, and non-default snapshot names; it is
not a tenant identifier and does not change application data access.

Choose an unused private `APP_NETWORK_SUBNET` on the Docker host. Compose pins
the bridge gateway and passes that exact gateway `/32` to the application as
its trusted immediate HTTP proxy. Loopback is also trusted. Do not replace this
with a whole private range or a wildcard: only Caddy traffic entering through
the loopback-published host port should be allowed to control
`X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-For`. Use a different
subnet and gateway for every additional instance on the same host.

Create the backup directory separately from application data, then start the
instance with an explicit Compose project:

```bash
sudo install -d -m 0700 -o <DEPLOY_USER> -g <DEPLOY_GROUP> /srv/backups/inbox-point/organization-a
docker compose -p organization-a --env-file .env config --quiet
docker compose -p organization-a --env-file .env up -d --build
docker compose -p organization-a ps
```

All application-owned persistent files are under `/app/data`: SQLite plus
content, service-control, and locally managed channel settings. The named volume
is scoped by the Compose project. The backup bind mount is separate and must
also be unique per instance.

## 5. Put Caddy in front

Install Caddy on the RU host, copy `Caddyfile.example` to `/etc/caddy/Caddyfile`,
replace the domain and upstream port, and validate before reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl --fail https://inboxpoint.ru/health
curl --fail https://inboxpoint.ru/ready
```

The template relies on Caddy 2.10 or newer for the 1 MB request-body limit. It
also provides automatic HTTPS, compression, a loopback reverse proxy, and basic
security headers. DNS A/AAAA records must point to the RU server. Do not put the
admin UI on plain HTTP.

From a browser, open the public HTTPS admin UI, sign in, complete one intended
state-changing action such as saving the initial content, reload the page to
confirm the saved value, and sign out. A `403` from login, save, or logout fails
this reverse-proxy smoke test. Do not accept a deployment based only on the two
GET health checks above.

## 6. Configure monitoring

Build the same pinned source on an independent host. Copy
`.env.monitor.example` to `/etc/inbox-point/monitor.env`, set mode `0600`,
and use the same `INSTANCE_ID`. The alert webhook must remain usable when the
application host or Telegram is unavailable.

Install and enable the example service after adapting its user and paths:

```bash
sudo install -m 0644 deploy/systemd/inbox-point-availability-monitor.service.example /etc/systemd/system/inbox-point-availability-monitor.service
sudo systemctl daemon-reload
sudo systemctl enable --now inbox-point-availability-monitor
sudo journalctl -u inbox-point-availability-monitor -f
```

Stop the application long enough to confirm one outage alert, restart it, and
confirm one recovery alert. Both the alert message and webhook JSON carry the
instance label.

## 7. Back up and restore

Run and inspect the external backup before scheduling it:

```bash
docker compose -p organization-a --env-file .env --profile operations run --rm backup
find /srv/backups/inbox-point/organization-a -maxdepth 2 -type f -name manifest.json -print
```

For multiple isolated deployments on one host, place each checkout at
`/opt/inbox-point-<instance>` and enable its template timer, for example:

```bash
sudo install -m 0644 deploy/systemd/inbox-point-backup@.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/inbox-point-backup@.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now inbox-point-backup@organization-a.timer
```

Snapshot directories and manifests identify the instance. Rotation matches only
that instance's prefix, so one job cannot prune another instance's snapshots
even if an operator accidentally points both at one parent directory. Still use
separate paths to prevent operational mistakes and capacity contention.

Restore only while the affected instance is stopped, and never restore over a
live data directory:

```bash
docker compose -p organization-a --env-file .env down
npm run snapshot:restore -- <SNAPSHOT_DIRECTORY> <NEW_EMPTY_DATA_DIRECTORY>
```

Verify the restored database and state in an isolated deployment before moving
them into the instance volume. Channel credentials and `.env` are deliberately
excluded and must come from a separate secret backup. A rollback uses the
previous pinned image/source plus a verified compatible snapshot, followed by
the acceptance checks below.

## 8. Acceptance and failure drills

Before enabling real conversations, verify:

1. `/health`, `/ready`, login/logout, setup, content, monitoring, and emergency
   inbox through the public HTTPS origin.
2. Telegram intake and reply through the egress proxy, and VK intake and reply
   directly from the RU server.
3. A proxy stop or WireGuard break makes Telegram fail visibly without rerouting
   VK, alerts, or other traffic through another proxy.
4. Telegram resumes after proxy recovery; pending deliveries and active requests
   survive application and host restarts.
5. VK and Telegram API failure, retry, uncertain delivery, quarantine, manual
   resolution, and web-inbox fallback paths.
6. A manual backup, checksum verification, isolated restore, monitor outage and
   recovery alerts, disk-capacity alerting, and the recorded rollback artifact.

Invalid `INSTANCE_ID` or `TELEGRAM_PROXY_URL` values stop startup with a
sanitized configuration error. An unreachable but syntactically valid proxy
does not fall back to a direct Telegram connection: Telegram calls fail through
that dedicated transport and normal channel/readiness failure handling applies.

## First-organization runbook

Use this order for the first production installation:

1. Prepare the RU VPS, deployment user, Docker Engine, and Compose plugin.
2. Prepare the foreign VPS with WireGuard and Tinyproxy packages.
3. Generate host-specific WireGuard keys and install both `wg0` files.
4. Apply both firewall policies and bring up the private tunnel.
5. Install and start the Tinyproxy systemd service on the foreign VPS.
6. Run both proxy `curl` checks from the RU VPS: Telegram succeeds and the
   unrelated host is denied.
7. Point the production DNS record at the RU VPS.
8. Install Caddy, validate its configuration, and obtain TLS.
9. Create the instance `.env`, unique backup directory, and `INSTANCE_ID`.
10. Validate Compose and start `docker compose -p <instance> ... up -d --build`.
11. Open the HTTPS admin UI and sign in with the production password.
12. Connect Telegram and VK, unless they are environment-managed.
13. Verify public HTTPS `/health` and `/ready`.
14. Complete one test conversation and operator reply in each channel.
15. Restart with `docker compose -p <instance> --env-file .env restart app`,
    then repeat readiness and active-request checks.
16. Install the independent monitor and exercise outage and recovery alerts.
17. Run one external backup, then enable the instance-specific backup timer.
18. Stop the test instance, restore the snapshot into a new directory, verify
    it in isolation, and record the rollback image/source reference.

## Adding another organization later

Repeat the deployment with a new checkout or immutable image reference, domain,
`.env`, `INSTANCE_ID`, Compose project (`-p organization-b`), loopback host port,
Docker bridge subnet and gateway, backup directory, monitor configuration, and
credentials. Do not share volumes, network subnets, SQLite files, channel
settings, sessions, or administrator passwords. No `tenant_id`, organization
selector, or cross-instance control plane is required.

The intended evolution path is deliberately incremental:

1. Keep one organization per isolated instance and provision the next instance
   manually from the same release and templates.
2. If repeated setup becomes an operational bottleneck, automate instance
   creation, upgrades, backup checks, and aggregate health reporting. Keep each
   instance's application credentials and conversation data isolated.
3. Consider a shared multi-tenant runtime only if production evidence shows
   that isolated instances no longer meet operational or product needs. That
   would require a separate security model, tenant-aware authorization, data
   migration, restore boundaries, and explicit acceptance; it is not a routine
   configuration change.

Operator-team growth is a separate concern. If production observation shows
that operators collide or requests lack ownership, start with a lightweight
claim/release action. Add roles, queues, SLA rules, or CRM entities only after
that smaller coordination model proves insufficient.
