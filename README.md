# Messenger Handoff

Messenger Handoff is a small self-hosted service that connects customer
conversations from Telegram and VK with an operator workspace in Telegram.
It is intended for organizations that want to keep people in their original
messaging channel without adopting a full helpdesk platform.

## How it works

1. A person writes to a Telegram bot or VK community.
2. The service can return configured information such as a schedule, prices,
   address, FAQs, or custom sections.
3. A question that needs an operator becomes a separate topic in a private
   Telegram group.
4. An operator replies in that topic.
5. The reply is delivered to the same Telegram or VK conversation.

Telegram Topics keep each active request in a separate thread while allowing
operators to stay in a familiar interface. If Telegram is unavailable, the
request can be moved to a protected emergency web inbox. An active conversation
is handled either in Telegram or in the web inbox, never in both at once.

## Supported scope

- text conversations from Telegram bots and VK communities;
- configurable information sections;
- durable SQLite delivery queue with bounded retries;
- explicit handling of uncertain delivery outcomes;
- crash-safe operator relay state with manual resolution for uncertain Telegram
  outcomes;
- bounded VK event retries with quarantine and operator retry/skip controls;
- protected channel setup, content management, and operations pages with one
  administrator sign-in;
- emergency web inbox;
- verified snapshots for the database, content, and service-control state, plus
  an external backup job and daily systemd timer template.

Message attachments, voice messages, AI-generated replies, CRM entities,
operator assignment, multi-tenancy, and SaaS billing are outside the first
release. Unsupported attachments receive a request to resend the question as
text.

## Data

Requests, message routing, delivery state, and minimal usage events are stored
locally in SQLite. Configured information and service-control state are stored
next to the database. Usage events do not contain message text. Service
snapshots exclude Telegram and VK credentials, passwords, and `.env` files.

## Local development

Requires Node.js 24.20.x and npm 11.

```bash
npm ci
npm run dev
```

The service uses safe local defaults. To override them, copy `.env.example` to
an untracked `.env`; both `npm run dev` and `npm start` load it automatically.

Local routes:

- `http://127.0.0.1:3000/login` — administrator sign-in when a password is set;
- `http://127.0.0.1:3000/setup` — connect Telegram and VK;
- `http://127.0.0.1:3000/manage` — edit information shown in Telegram and VK;
- `http://127.0.0.1:3000/ops` — inspect service state, delivery incidents, and
  emergency requests;
- `http://127.0.0.1:3000/health` and `/ready` — health and readiness checks.

The administration frontend is one Vue Router application. Direct reloads and
browser back/forward navigation work for all routes; unknown frontend paths show
the application 404 page, while unknown `/api/*` paths return HTTP 404.

Authentication depends on the environment:

- development without `ADMIN_PASSWORD` allows loopback access without a login
  and does not show logout;
- development with `ADMIN_PASSWORD` uses the real login, session, and logout
  flow;
- production exposes the administration UI only when `ADMIN_PASSWORD` is set.

The password session lasts 12 hours. Its cookie is HTTP-only, `SameSite=Strict`,
uses `Path=/`, and is `Secure` with the `__Host-` prefix in production. Run the
normal code, test, and build gate with:

```bash
npm run check
```

Browser end-to-end checks are separate:

```bash
npx playwright install chromium
npm run check:e2e
```

CI runs both gates and uses Playwright Chromium for routing, authentication,
logout, reload, back/forward navigation, responsive layout, and layout-stability
checks.

## Channel lifecycle

The Channels page shows whether each connection comes from `environment` or
`local` settings. Environment-managed connections are changed on the server and
cannot be disconnected in the UI or setup API. Locally managed connections can
be connected, disconnected, and connected again without deleting request
history. VK must be disconnected before Telegram because its operator handoff
depends on Telegram. The backend enforces this order.

A disconnect stops the channel before deleting its local settings. If stopping
fails, settings remain untouched. If deleting the settings fails, the runtime is
already stopped but the settings remain available for a retry or the next
service start.

## Operations and backups

`/health` only confirms that the HTTP process responds. `/ready` returns 503
when a configured Telegram or VK poller is failed, stopped, or stale; when the
delivery worker is stopped or stalled; when deliveries are backlogged or stale;
or when unresolved inbound/operator-relay incidents exist. A channel that has
not been configured is not by itself a readiness failure.

The Docker healthcheck uses `/health`. Run the separate availability monitor
from an independent host with `.env.monitor`; it must check the HTTPS `/ready`
URL and alert through a webhook independent of Telegram.

After a production build, `npm run snapshot:create` creates a verified service
snapshot and `npm run snapshot:restore -- <snapshot> <new-data-directory>`
restores it only into a new directory. A snapshot contains SQLite, saved content,
service-control state, checksums, and metadata. It excludes channel credentials,
passwords, and `.env` files.

The `operations` Compose profile runs a one-shot verified external backup:

```bash
docker compose --env-file .env --profile operations run --rm backup
```

Its `BACKUP_HOST_PATH` bind mount must be outside the application volume and,
preferably, off the application VPS. The job verifies the result, rotates old
generations, returns a non-zero exit code on failure, and sends an independent
webhook alert. Daily systemd service and timer templates are in `deploy/systemd`.

## Production deployment

The supported topology is one isolated instance per organization. The RU server
runs the application, data, administration UI, VK integration, Caddy, and
backups. A small foreign VPS provides only a WireGuard-restricted HTTP CONNECT
path for Telegram; bot credentials remain on the application server and other
traffic is not proxied.

See the [production deployment guide](deploy/README.md) for WireGuard,
Tinyproxy, firewall, Caddy, instance-aware Compose, backup/restore, independent
monitoring, scaling, and acceptance procedures. The guide and templates use
`INSTANCE_ID` only as an operational label; the application remains
single-organization and has no multi-tenant data model.

Additional organizations are deployed as additional isolated instances. If
manual deployment later becomes the limiting factor, provisioning and aggregate
health reporting can be automated around those instances without sharing their
conversation data. A shared multi-tenant runtime is a separate future product
decision, not the default scaling path.

## Status

The release-blocking dependency, operator-relay, VK quarantine, readiness
monitoring, external-backup, instance labeling, and Telegram-only proxy
mechanisms are implemented and covered by automated checks. Production remains
unaccepted until the target servers, real channels, restart/failure drills,
restore, rollback, and operator workflow pass the deployment guide.

## License

MIT
