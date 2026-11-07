CREATE TABLE "invitation_views_daily" (
	"invitation_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invitation_views_daily_invitation_id_day_pk" PRIMARY KEY("invitation_id","day")
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitation_views_daily" ADD CONSTRAINT "invitation_views_daily_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;