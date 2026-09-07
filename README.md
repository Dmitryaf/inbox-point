# Messenger Handoff

Messenger Handoff is a small self-hosted service that connects customer
conversations from Telegram and VK with an operator workspace in Telegram.
It is intended for organizations that want to keep people in their original
messaging channel without adopting a full helpdesk platform.

## How it works

1. A person writes to a Telegram bot or VK community.
2. The service can return configured information such as a schedule, prices,
   address, FAQs, or custom sections.
3. A question that needs a person becomes a separate topic in a private
   Telegram group.
4. An operator replies in that topic.
5. The reply is delivered to the same Telegram or VK conversation.

Telegram Topics keep each active request in a separate thread while allowing
operators to stay in a familiar interface. If the Telegram operator interface
is unavailable, the request can be moved to a protected emergency web inbox.
Only one of these operator surfaces owns an active request at a time.

## Supported scope

- text conversations from Telegram bots and VK communities;
- configurable information sections;
- durable SQLite delivery queue with bounded retries;
- explicit handling of uncertain delivery outcomes;
- protected content management and operations pages;
- emergency web inbox;
- snapshots for the database, content, and service-control state.

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
npm install
npm run dev
```

Local routes:

- `http://127.0.0.1:3000/setup` — connect development channels and create a
  backup;
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
proxy, and `/ops` requires an additional network restriction in production.

## Status

The text handoff workflow, delivery recovery, emergency web inbox, management
UI, operational controls, snapshots, and local deployment hardening are
implemented and covered by automated checks. Production deployment is not yet
verified: the Docker image, persistent volume, reverse proxy, external monitor,
real test channels, restart, restore, rollback, and operator acceptance must be
completed in the target environment before real conversations are enabled.

## License

MIT
