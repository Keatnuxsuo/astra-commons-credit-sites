CREATE TABLE `attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`match_name` text NOT NULL,
	`pair_id` integer NOT NULL,
	FOREIGN KEY (`pair_id`) REFERENCES `reward_pairs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guests_email_unique` ON `guests` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `guests_pair_id_unique` ON `guests` (`pair_id`);--> statement-breakpoint
CREATE TABLE `reward_pairs` (
	`id` integer PRIMARY KEY NOT NULL,
	`api_code` text NOT NULL,
	`codex_url` text NOT NULL,
	`issued_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reward_pairs_api_code_unique` ON `reward_pairs` (`api_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `reward_pairs_codex_url_unique` ON `reward_pairs` (`codex_url`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
