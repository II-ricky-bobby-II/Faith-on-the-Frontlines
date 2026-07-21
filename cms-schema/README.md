# Payload CMS schema

This folder contains the Payload collections expected by the Faith on the Frontlines frontend.

## Add to a Payload project

1. Create or open a Payload 3 project using a supported Next.js release.
2. Copy `collections/` into that project.
3. Merge `payload.config.example.ts` into the project's `payload.config.ts`.
4. Add the variables from `.env.example` and configure durable media storage for the chosen host.
5. Generate types, run migrations, start Payload, and create the first admin user at `/admin`.
6. Create and publish event records. Draft events are not exposed publicly.
7. Set `PAYLOAD_CMS_URL` on the frontend to the Payload origin, without `/api`.

The frontend requests `/api/events` with `depth=1`, date sorting, and published-status filtering. Uploaded images are populated through the `media` relationship. If the Payload service is unavailable or no URL is configured, the website safely uses its bundled sample events.
