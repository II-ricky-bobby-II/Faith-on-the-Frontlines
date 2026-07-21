import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";
import { Events } from "./collections/Events";
import { Media } from "./collections/Media";
import { Users } from "./collections/Users";

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

export default buildConfig({
  admin: { user: Users.slug },
  collections: [Users, Media, Events],
  cors: [frontendUrl],
  csrf: [frontendUrl],
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL || "" } }),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL,
  sharp,
  typescript: { outputFile: "./payload-types.ts" },
});
