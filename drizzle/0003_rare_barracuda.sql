CREATE TABLE `reviews` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`listing_id` varchar(64) NOT NULL,
	`author` varchar(120) NOT NULL,
	`rating` tinyint NOT NULL,
	`body` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `reviews_listing_status_idx` ON `reviews` (`listing_id`,`status`);--> statement-breakpoint
CREATE INDEX `reviews_status_created_idx` ON `reviews` (`status`,`created_at`);