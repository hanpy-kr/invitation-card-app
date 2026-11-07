ALTER TABLE "users" ALTER COLUMN "kakao_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "anonymous" boolean DEFAULT false NOT NULL;