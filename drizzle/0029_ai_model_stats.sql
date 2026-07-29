CREATE TABLE "ai_model_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"error_code" text DEFAULT '' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_model_stats_bucket" ON "ai_model_stats" USING btree ("provider","model","status","error_code");--> statement-breakpoint
CREATE INDEX "idx_ai_model_stats_provider_model" ON "ai_model_stats" USING btree ("provider","model");