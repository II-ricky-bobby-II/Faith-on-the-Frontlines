# Faith on the Frontlines

Production-ready ministry website for Faith on the Frontlines, a Global Fellowship ministry. Built with the Next.js App Router, TypeScript, Tailwind CSS 4, and reusable accessible React components.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal. Create a production build with `npm run build`.

## Content

Published event content is loaded from Payload CMS through `lib/payload.ts` and remains typed by `types/event.ts`. Configure `PAYLOAD_CMS_URL` using `.env.example`. If Payload is not configured or temporarily unavailable, the site falls back to the sample events in `data/events.ts`.

The matching Payload collection schemas are included in `cms-schema/`. They provide authenticated editors, draft-enabled events, media uploads, public access to published records, and the exact fields consumed by the website.

The inquiry endpoint at `app/api/inquiry/route.ts` validates a minimal payload and returns a success response. Before launch, connect the marked integration point to Global Fellowship's approved email or CRM provider and replace placeholder contact details.

Photography is loaded from Unsplash through `next/image`. Replace remote image URLs with approved Global Fellowship photography in `public/images` when final assets are available.
