# Inbox Point

Self-hosted customer messaging for Telegram and VK. Customers stay in their messenger; staff reply in a private Telegram group with a topic for each customer. The browser interface is in Russian.

Java 25 · Spring Boot · SQLite · React · TypeScript

## Available workflows

- Prepared information: schedules, prices, addresses, FAQs and custom menu sections.
- Directions and class groups, meeting times, enrollment availability and a question for an application. Staff can confirm a class application from Telegram.
- Text questions and staff replies, closing requests and starting a new request in the existing customer topic.
- Edit customer answers from the conversation preview, view revision history and recover unsaved edits.
- Channel setup, pause/resume and delivery alerts. The fallback browser inbox loads active requests and earlier messages in pages.
- Usage analytics for 7, 30 or 90 days, with Telegram/VK filters.

Closed enrollment offers a question about the group. It does not accept an enrollment application. Attachments and voice messages are not relayed as supported customer text. Answers come from prepared content or staff; AI-generated replies are not implemented.

![Content editor with example data](docs/screenshots/inbox-point-content.png)

[View the operations dashboard](docs/screenshots/inbox-point-operations.png)

## Run locally

Install JDK 25 and npm 11. Use the frontend toolchain version pinned in [`.nvmrc`](.nvmrc). The Maven Wrapper builds the Spring Boot application.

```sh
npm ci
npm run dev
```

Open [channel setup](http://127.0.0.1:3000/setup), [content](http://127.0.0.1:3000/manage), [analytics](http://127.0.0.1:3000/analytics) or [operations](http://127.0.0.1:3000/ops). Development uses local access rules; production requires the configured administrator password and HTTPS.

## Deployment and development

One instance serves one organization, with its own SQLite database and adjacent settings. See the [deployment guide](deploy/README.md) for isolation, backup and updates.

```sh
npm run check
npx playwright install chromium
npm run check:e2e
```

The Spring Boot application and Java tests are in `backend/`. The React interface is in `frontend/src/`, and Playwright exercises it against the packaged Java application.

[MIT License](LICENSE)
