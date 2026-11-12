CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid,
	"user_id" uuid,
	"order_id" text NOT NULL,
	"order_name" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_key" text,
	"method" text,
	"receipt_url" text,
	"refund_agreed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"fail_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "premium_order_id" uuid;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "derived_from_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_id_idx" ON "orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_invitation_idx" ON "orders" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_one_paid_idx" ON "orders" USING btree ("invitation_id") WHERE "orders"."status" = 'paid';--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_derived_from_id_invitations_id_fk" FOREIGN KEY ("derived_from_id") REFERENCES "public"."invitations"("id") ON DELETE set null ON UPDATE no action;