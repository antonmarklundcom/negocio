ALTER TABLE `listings` ADD `status` enum('draft','published','archived') DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX `listings_status_idx` ON `listings` (`status`);--> statement-breakpoint
CREATE INDEX `listings_status_categoria_ciudad_idx` ON `listings` (`status`,`categoria`,`ciudad`);