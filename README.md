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

Requires Node.js 24 and npm 11.

```bash
npm ci
npm run dev
```

The service uses safe local defaults. To override them, copy `.env.example` to
an untracked `.env`; both `npm run dev` and `npm start` load it automatically.

Local routes:

- `http://127.0.0.1:3000/setup` — connect Telegram and VK;
- `http://127.0.0.1:3000/manage` — edit information shown in Telegram and VK;
- `http://127.0.0.1:3000/ops` — inspect service state, delivery incidents, and
  emergency requests;
- `http://127.0.0.1:3000/health` and `/ready` — health and readiness checks.

Run the complete local verification with:

```bash
npm run check
```

Docker deployment files and a separate availability monitor are included. The
application port is intended to remain on loopback behind an HTTPS reverse
proxy. Set `ADMIN_PASSWORD` before production; without it the administrative
pages are unavailable in production mode.

The Docker liveness check uses `/health`. The external monitor must use
`/ready` and an alert webhook independent of Telegram. The `operations` Compose
profile provides a one-shot verified backup job; its bind-mounted target must
be stored outside the application volume and preferably outside the VPS.

## Status

The release-blocking dependency, operator-relay, VK quarantine, readiness
monitoring, and external-backup mechanisms are implemented and covered by
automated checks. Production deployment is not yet verified: the Docker image,
persistent volume, reverse proxy, external monitor host, offsite storage, real
test channels, host restart, rollback, and operator acceptance must be completed
in the target environment before real conversations are enabled.

## License

MIT
