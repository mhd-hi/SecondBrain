ALTER TABLE "mcp_connections" ADD COLUMN "key_hash" text;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD COLUMN "key_prefix" text;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD COLUMN "key_last_used_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mcp_connections_key_hash" ON "mcp_connections" USING btree ("key_hash");