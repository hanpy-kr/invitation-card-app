ALTER TYPE "public"."event_type" ADD VALUE 'christmas';--> statement-breakpoint
CREATE TABLE "gift_pairs" (
	"invitation_id" uuid NOT NULL,
	"giver_rsvp_id" uuid NOT NULL,
	"receiver_rsvp_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_pairs_invitation_id_giver_rsvp_id_pk" PRIMARY KEY("invitation_id","giver_rsvp_id")
);
--> statement-breakpoint
ALTER TABLE "gift_pairs" ADD CONSTRAINT "gift_pairs_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_pairs" ADD CONSTRAINT "gift_pairs_giver_rsvp_id_rsvps_id_fk" FOREIGN KEY ("giver_rsvp_id") REFERENCES "public"."rsvps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_pairs" ADD CONSTRAINT "gift_pairs_receiver_rsvp_id_rsvps_id_fk" FOREIGN KEY ("receiver_rsvp_id") REFERENCES "public"."rsvps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_pairs_receiver_idx" ON "gift_pairs" USING btree ("receiver_rsvp_id");