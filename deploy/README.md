# Deploying Inbox Point

This guide describes the current single-organization deployment. Use a separate Compose project, data volume, `.env`, host port, private subnet, domain and backup destination for each organization.

## Prepare an instance

Install Docker Compose and an HTTPS reverse proxy. The container runs Inbox Point on Java 25. Copy [.env.example](../.env.example) into a private instance environment file and configure:

| Setting                                     | Purpose                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `INSTANCE_ID`                               | Stable instance identity                             |
| `ADMIN_PASSWORD`                            | Production administrator password, 12–200 characters |
| `HOST_PORT`                                 | Loopback application port, default 3101              |
| `APP_NETWORK_SUBNET`, `APP_NETWORK_GATEWAY` | Unique private network for this instance             |
| `BACKUP_HOST_PATH`                          | Private backup directory outside application data    |
| `BACKUP_ALERT_WEBHOOK_URL`                  | HTTPS alert destination for external backup          |

Leave channel `*_ENABLED=false` to configure that channel through the protected UI. For environment-managed channels provide the complete token/group configuration before enabling them. Keep environment files and channel settings private.

```sh
docker compose -p organization --env-file /secure/organization.env up -d --build app
docker compose -p organization --env-file /secure/organization.env ps app
docker compose -p organization --env-file /secure/organization.env logs --tail=100 app
```

[compose.yaml](../compose.yaml) binds the host port to `127.0.0.1`, persists `/app/data` and restarts the service unless stopped. Never remove its volume to update the app.

## HTTPS and channels

Adapt [Caddyfile.example](Caddyfile.example) to the domain and loopback port. The proxy must be the immediate trusted peer; the Compose gateway supplies `HTTP_TRUSTED_PROXIES`. Do not expose port 3101 directly to the internet.

Open `/setup` over HTTPS and sign in. Telegram needs a bot and a private forum supergroup where the bot can manage topics; an existing webhook conflicts with long polling. Connect VK using the settings exposed by the application. Test with synthetic messages before routing customer traffic.

`/manage` edits customer information and class groups; `/analytics` reports usage; `/ops` exposes delivery incidents, pause/resume and the emergency inbox.

## Optional Telegram egress

Only Telegram Bot API traffic uses `TELEGRAM_PROXY_URL`. Other requests retain their direct route. The supplied topology uses WireGuard between the application host and an egress host, then Tinyproxy on the private interface.

- WireGuard templates: [application peer](wireguard/ru.conf.example), [egress peer](wireguard/egress.conf.example).
- Proxy configuration: [Tinyproxy](tinyproxy/inbox-point.conf.example), [host allowlist](tinyproxy/telegram-domains.example), [service](systemd/inbox-point-telegram-egress.service).

Replace placeholders and protect keys. Keep the proxy reachable only from the application peer and restricted to HTTPS CONNECT for `api.telegram.org`. No application tokens, database or backup belong on the egress host. Verify both an allowed Telegram connection and refusal of an unrelated host before enabling the proxy URL. Do not set a global HTTP proxy for the process.

## Health and incident handling

Check local and public `/health` and `/ready`. Readiness includes channel expectations, delivery worker, queue and inbound/operator incidents. A process health response alone does not establish channel delivery.

Use an independent HTTPS monitor and alert destination. Install Java 25 and place the packaged application at `/opt/inbox-point-monitor/inbox-point.jar` for the systemd template. Configure it with [.env.monitor.example](../.env.monitor.example) and [the service template](systemd/inbox-point-availability-monitor.service.example).

For failed or uncertain messages, inspect `/ops` before retrying. An uncertain external send may already have reached its recipient. Use the specific resolution action rather than replaying a whole request.

## Backup and restore

The operations profile mounts application data read-only and exports to `BACKUP_HOST_PATH`:

```sh
docker compose -p organization --env-file /secure/organization.env --profile operations run --rm backup
```

Backup requires the configured HTTPS alert webhook. Export goes outside application data. The service snapshot includes SQLite, customer content and service-control state with a verified manifest. Channel credentials are excluded; preserve them separately in a protected location.

The [instance timer](systemd/inbox-point-backup@.timer) and [service](systemd/inbox-point-backup@.service) provide scheduled execution templates. Review their paths and instance environment before installation. Copying to another directory on the same host does not protect against host loss.

The application JAR supports `snapshot-create`, `snapshot-verify <snapshot-path>` and `snapshot-restore <snapshot-path> <new-target-directory>`. For a drill, verify the snapshot and restore it to a new isolated directory. Restored channel expectations remain set, and signing in requires a fresh session.

## Update

Run the supplied updater from the repository with the intended target branch/remote already configured:

```sh
./deploy/update-instance.sh \
  --project organization \
  --env /secure/organization.env \
  --public-url https://messages.example.com
```

The updater validates the checkout, creates and verifies a pre-deploy snapshot, updates the instance and checks container and public health. It reports the failure stage and snapshot on failure. For a runtime migration, keep the previous image, stop the current application before starting another version on the same volume, and check that the previous version can read any new data before rolling back.

Validate the source change with `npm run check` and `npm run check:e2e`. Before accepting a deployment, verify real test-channel messages, staff replies, closing/reopening, enrollment confirmation, content editing and backup recovery as applicable. Record the deployed revision and observations for that instance.
