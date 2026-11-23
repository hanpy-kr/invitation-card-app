ALTER TABLE "invitations" ADD COLUMN "first_shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "first_guest_view_at" timestamp with time zone;