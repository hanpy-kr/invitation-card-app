CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"name" varchar(20) NOT NULL,
	"choices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edit_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poll_votes_invitation_idx" ON "poll_votes" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "poll_votes_edit_token_idx" ON "poll_votes" USING btree ("edit_token_hash");