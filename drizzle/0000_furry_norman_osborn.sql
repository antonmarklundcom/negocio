CREATE TABLE `categories` (
	`slug` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL,
	`label_plural` varchar(120) NOT NULL,
	`icon` varchar(64) NOT NULL,
	`block_kind` enum('food','shop','service','default') NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_slug` PRIMARY KEY(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`slug` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`lat` decimal(9,6),
	`lng` decimal(9,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cities_slug` PRIMARY KEY(`slug`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`source` enum('listing_message','listing_whatsapp','sumate','contacto') NOT NULL,
	`listing_id` varchar(64),
	`listing_slug` varchar(191),
	`message` text,
	`business_name` varchar(160),
	`category` varchar(80),
	`city` varchar(80),
	`name` varchar(120),
	`contact` varchar(160),
	`email` varchar(160),
	`phone` varchar(40),
	`delivered_sinks` int,
	`configured_sinks` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listing_gallery` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listing_id` varchar(64) NOT NULL,
	`url` varchar(255) NOT NULL,
	`position` int NOT NULL,
	`alt` varchar(200),
	CONSTRAINT `listing_gallery_id` PRIMARY KEY(`id`),
	CONSTRAINT `listing_gallery_unique_position` UNIQUE(`listing_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `listing_hours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listing_id` varchar(64) NOT NULL,
	`day` tinyint NOT NULL,
	`open_minute` smallint NOT NULL,
	`close_minute` smallint NOT NULL,
	CONSTRAINT `listing_hours_id` PRIMARY KEY(`id`),
	CONSTRAINT `listing_hours_unique_range` UNIQUE(`listing_id`,`day`,`open_minute`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` varchar(64) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`name` varchar(200) NOT NULL,
	`categoria` varchar(64) NOT NULL,
	`ciudad` varchar(64) NOT NULL,
	`subtitle` varchar(200),
	`description` text,
	`zona` varchar(120),
	`address` varchar(255),
	`lat` decimal(9,6),
	`lng` decimal(9,6),
	`phone` varchar(40),
	`whatsapp` varchar(20),
	`email` varchar(160),
	`website` varchar(255),
	`instagram` varchar(80),
	`cover_image` varchar(255),
	`especialidades` json,
	`destacado_item` json,
	`productos` json,
	`servicios` json,
	`verified` boolean NOT NULL DEFAULT false,
	`premium_until` bigint,
	`rating` decimal(2,1),
	`reviews_count` int,
	`years_active` int,
	`avg_response_mins` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `listings_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `listing_gallery` ADD CONSTRAINT `listing_gallery_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `listing_hours` ADD CONSTRAINT `listing_hours_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_categoria_categories_slug_fk` FOREIGN KEY (`categoria`) REFERENCES `categories`(`slug`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_ciudad_cities_slug_fk` FOREIGN KEY (`ciudad`) REFERENCES `cities`(`slug`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `leads_listing_created_idx` ON `leads` (`listing_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `leads_source_created_idx` ON `leads` (`source`,`created_at`);--> statement-breakpoint
CREATE INDEX `listing_hours_listing_day_idx` ON `listing_hours` (`listing_id`,`day`);--> statement-breakpoint
CREATE INDEX `listings_categoria_idx` ON `listings` (`categoria`);--> statement-breakpoint
CREATE INDEX `listings_ciudad_idx` ON `listings` (`ciudad`);--> statement-breakpoint
CREATE INDEX `listings_categoria_ciudad_idx` ON `listings` (`categoria`,`ciudad`);--> statement-breakpoint
CREATE INDEX `listings_zona_idx` ON `listings` (`zona`);--> statement-breakpoint
CREATE INDEX `listings_premium_until_idx` ON `listings` (`premium_until`);