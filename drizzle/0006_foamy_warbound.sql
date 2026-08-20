CREATE TABLE `sales` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`listing_id` varchar(64) NOT NULL,
	`listing_name` varchar(200) NOT NULL,
	`package_kind` enum('premium','featured') NOT NULL,
	`days` int NOT NULL,
	`amount_gs` bigint NOT NULL,
	`method` enum('pagopar','bancard','tigo','efectivo','otro') NOT NULL,
	`sold_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_sold_by_users_id_fk` FOREIGN KEY (`sold_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sales_listing_idx` ON `sales` (`listing_id`);--> statement-breakpoint
CREATE INDEX `sales_created_idx` ON `sales` (`created_at`);