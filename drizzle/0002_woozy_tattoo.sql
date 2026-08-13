ALTER TABLE `listings` ADD `featured_until` bigint;--> statement-breakpoint
CREATE INDEX `listings_featured_until_idx` ON `listings` (`featured_until`);