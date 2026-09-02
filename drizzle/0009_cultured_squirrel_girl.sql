ALTER TABLE `listings` ADD `search_text` text;--> statement-breakpoint
CREATE INDEX `listings_search_text_idx` ON `listings` (`search_text`(191));