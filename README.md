# Messenger Handoff

Messenger Handoff is a planned self-hosted service for handling customer messages from Telegram and VK in one operator workspace.

## How it works

1. A customer opens a Telegram bot or writes to a VK community.
2. The service answers common questions or offers to contact an operator.
3. A request becomes a separate topic in a private Telegram group.
4. An operator replies in that topic.
5. The customer receives the reply in the original channel.

Operators work in Telegram, while customers do not need to switch between services.

## Technology

- TypeScript and Node.js
- React and Vite for the owner interface
- SQLite
- Telegram Bot API
- VK API
- Docker for deployment

## Local development

Requires Node.js 24 and npm 11.

```bash
npm install
npm run dev
```

The service status is available at `http://127.0.0.1:3000/health`.

Run all project checks with:

```bash
npm run check
```

## Status

The development foundation is available. Telegram and VK integrations are not implemented yet.

## License

MIT
