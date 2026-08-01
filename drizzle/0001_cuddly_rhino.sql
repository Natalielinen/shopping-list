ALTER TABLE "items" ADD COLUMN "category" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "urgency" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "need" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "benefit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "doubts" text DEFAULT 'sure' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_credit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "deadline" date;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "monthly_payment" integer;