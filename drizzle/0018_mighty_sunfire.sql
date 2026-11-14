CREATE TABLE "webhook_events" (
	"key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider" text DEFAULT 'toss' NOT NULL;