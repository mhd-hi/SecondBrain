CREATE TABLE "mcp_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" uuid,
	"tool_name" text NOT NULL,
	"draft_id" uuid,
	"outcome" text NOT NULL,
	"correlation_id" text NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"oauth_issuer" text NOT NULL,
	"oauth_subject" text NOT NULL,
	"oauth_client_id" text NOT NULL,
	"oauth_grant_id" text NOT NULL,
	"client_name" text DEFAULT 'MCP client' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mcp_rate_limits" (
	"key" text NOT NULL,
	"window_started_at" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "mcp_rate_limits_key_window_started_at_pk" PRIMARY KEY("key","window_started_at")
);
--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "source" text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "source_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "request_namespace" text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "approval_capability_hash" text;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "approval_capability_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "approval_capability_consumed_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "approval_channel" text;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "terminal_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD COLUMN "execution_receipt" jsonb;--> statement-breakpoint
ALTER TABLE "mcp_audit_events" ADD CONSTRAINT "mcp_audit_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_audit_events" ADD CONSTRAINT "mcp_audit_events_connection_id_mcp_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mcp_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mcp_audit_events_user_created" ON "mcp_audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_mcp_audit_events_draft" ON "mcp_audit_events" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_audit_events_connection" ON "mcp_audit_events" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mcp_connections_issuer_grant" ON "mcp_connections" USING btree ("oauth_issuer","oauth_grant_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_connections_user_id" ON "mcp_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_rate_limits_expires_at" ON "mcp_rate_limits" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD CONSTRAINT "ai_action_drafts_source_connection_id_mcp_connections_id_fk" FOREIGN KEY ("source_connection_id") REFERENCES "public"."mcp_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_action_drafts_user_ns_request" ON "ai_action_drafts" USING btree ("user_id","request_namespace","request_id");