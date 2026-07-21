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

Event content lives in `data/events.ts` and is typed by `types/event.ts`. This is intentionally isolated so it can later be replaced by a CMS or API.

The inquiry endpoint at `app/api/inquiry/route.ts` validates a minimal payload and returns a success response. Before launch, connect the marked integration point to Global Fellowship's approved email or CRM provider and replace placeholder contact details.

Photography is loaded from Unsplash through `next/image`. Replace remote image URLs with approved Global Fellowship photography in `public/images` when final assets are available.
