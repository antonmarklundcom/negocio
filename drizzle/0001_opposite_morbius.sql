CREATE TABLE `activity_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`entity_type` varchar(32) NOT NULL,
	`entity_id` varchar(64) NOT NULL,
	`action` enum('create','update','delete','archive') NOT NULL,
	`before_json` json,
	`after_json` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(160) NOT NULL,
	`name` varchar(120) NOT NULL,
	`password_hash` varchar(255),
	`role` enum('admin','editor','owner_admin','owner_editor') NOT NULL,
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`must_change_password` boolean NOT NULL DEFAULT false,
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_idx` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `activity_log_entity_idx` ON `activity_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `activity_log_created_idx` ON `activity_log` (`created_at`);