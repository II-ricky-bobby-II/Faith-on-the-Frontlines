import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const eventInvitations = sqliteTable(
  "event_invitations",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    cityState: text("city_state"),
    source: text("source").notNull().default("website"),
    consent: integer("consent", { mode: "boolean" }).notNull().default(true),
    consentedAt: text("consented_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_event_invitations_email").on(table.email)],
);
