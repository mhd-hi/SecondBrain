DROP INDEX "uq_mcp_connections_key_hash";--> statement-breakpoint
ALTER TABLE "mcp_connections" DROP COLUMN "key_hash";--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD COLUMN "key_verifier" text;--> statement-breakpoint
CREATE INDEX "idx_mcp_connections_key_prefix" ON "mcp_connections" USING btree ("key_prefix");--> statement-breakpoint
ALTER TABLE "ai_action_drafts" DROP COLUMN "approval_capability_hash";--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "approval_capability_verifier" text;
