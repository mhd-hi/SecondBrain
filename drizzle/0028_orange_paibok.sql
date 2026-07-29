CREATE TABLE "ai_action_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"summary" text NOT NULL,
	"reason" text NOT NULL,
	"payload" jsonb NOT NULL,
	"task_versions" jsonb NOT NULL,
	"review_payload" jsonb NOT NULL,
	"failure_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_action_drafts" ADD CONSTRAINT "ai_action_drafts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_action_drafts_user_request" ON "ai_action_drafts" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE INDEX "idx_ai_action_drafts_user_id" ON "ai_action_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_action_drafts_status" ON "ai_action_drafts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_action_drafts_expires_at" ON "ai_action_drafts" USING btree ("expires_at");