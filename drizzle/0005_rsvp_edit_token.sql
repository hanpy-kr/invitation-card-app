ALTER TABLE "rsvps" ADD COLUMN "edit_token_hash" text;--> statement-breakpoint
CREATE INDEX "rsvps_edit_token_idx" ON "rsvps" USING btree ("edit_token_hash");