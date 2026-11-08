ALTER TABLE "users" ADD COLUMN "kakao_refresh_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_rsvp" boolean DEFAULT false NOT NULL;