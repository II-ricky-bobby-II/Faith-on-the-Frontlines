CREATE TABLE `deliveries` (
	`subscription_id` text NOT NULL,
	`event_id` text NOT NULL,
	`status` integer NOT NULL,
	`attempts` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`subscription_id`, `event_id`),
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`principal` text NOT NULL,
	`event_name` text NOT NULL,
	`arguments_json` text NOT NULL,
	`delivery_encrypted` text NOT NULL,
	`expires_at` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
