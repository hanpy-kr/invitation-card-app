ALTER TABLE "invitations" ADD COLUMN "premium_hub" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "premium_checked_at" timestamp with time zone;