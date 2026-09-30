-- Переход на версию 2 (бриф docs/BRIEF.md): старая модель для одного человека удаляется вместе с данными.
DROP TABLE IF EXISTS "transactions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "prices" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "instruments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "portfolio" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "milestones" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "login_attempts" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."asset_class";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."tx_kind";--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "assets_weight_range" CHECK ("assets"."weight" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"contribution_id" integer NOT NULL,
	"asset_id" integer NOT NULL,
	"amount_kopecks" bigint NOT NULL,
	CONSTRAINT "contribution_items_unique" UNIQUE("contribution_id","asset_id"),
	CONSTRAINT "contribution_items_amount_positive" CHECK ("contribution_items"."amount_kopecks" > 0)
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount_kopecks" bigint NOT NULL,
	CONSTRAINT "coupons_amount_positive" CHECK ("coupons"."amount_kopecks" > 0)
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_kopecks" bigint NOT NULL,
	CONSTRAINT "milestones_user_amount_unique" UNIQUE("user_id","amount_kopecks"),
	CONSTRAINT "milestones_amount_positive" CHECK ("milestones"."amount_kopecks" > 0)
);
--> statement-breakpoint
CREATE TABLE "portfolio_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"month" text NOT NULL,
	"date" date NOT NULL,
	"amount_kopecks" bigint NOT NULL,
	CONSTRAINT "portfolio_values_user_month_unique" UNIQUE("user_id","month"),
	CONSTRAINT "portfolio_values_amount_positive" CHECK ("portfolio_values"."amount_kopecks" > 0),
	CONSTRAINT "portfolio_values_month_format" CHECK ("portfolio_values"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "reinvests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount_kopecks" bigint NOT NULL,
	"asset_id" integer NOT NULL,
	CONSTRAINT "reinvests_amount_positive" CHECK ("reinvests"."amount_kopecks" > 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"quote" text NOT NULL,
	"plan_kopecks" bigint NOT NULL,
	"goal_kopecks" bigint NOT NULL,
	"strategy_enabled" boolean DEFAULT true NOT NULL,
	"strategy_name" text,
	CONSTRAINT "settings_plan_positive" CHECK ("settings"."plan_kopecks" > 0),
	CONSTRAINT "settings_goal_positive" CHECK ("settings"."goal_kopecks" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_items" ADD CONSTRAINT "contribution_items_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_items" ADD CONSTRAINT "contribution_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_values" ADD CONSTRAINT "portfolio_values_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reinvests" ADD CONSTRAINT "reinvests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reinvests" ADD CONSTRAINT "reinvests_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_user_idx" ON "assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_attempts_lookup_idx" ON "auth_attempts" USING btree ("kind","subject","at");--> statement-breakpoint
CREATE INDEX "contributions_user_date_idx" ON "contributions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "coupons_user_date_idx" ON "coupons" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "reinvests_user_date_idx" ON "reinvests" USING btree ("user_id","date");