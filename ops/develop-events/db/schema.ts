import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  principal: text("principal").notNull(),
  eventName: text("event_name").notNull(),
  argumentsJson: text("arguments_json").notNull(),
  deliveryEncrypted: text("delivery_encrypted").notNull(),
  expiresAt: integer("expires_at").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});

export const deliveries = sqliteTable("deliveries", {
  subscriptionId: text("subscription_id").notNull().references(() => subscriptions.id),
  eventId: text("event_id").notNull(),
  status: integer("status").notNull(),
  attempts: integer("attempts").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.subscriptionId, table.eventId] })]);
