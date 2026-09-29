CREATE TYPE "public"."asset_class" AS ENUM('stocks', 'bonds', 'cash');--> statement-breakpoint
CREATE TYPE "public"."tx_kind" AS ENUM('deposit', 'buy', 'income');--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_ticker_unique" UNIQUE("ticker")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "milestones_amount_unique" UNIQUE("amount"),
	CONSTRAINT "milestones_amount_positive" CHECK ("milestones"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "portfolio" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"title" text DEFAULT 'Моя стройка фундамента' NOT NULL,
	"subtitle" text DEFAULT 'Строю надёжно. Строю по плану. Без спешки.' NOT NULL,
	"quote" text DEFAULT '«Большие стены складываются из маленьких кирпичей, если класть их регулярно»' NOT NULL,
	"strategy_preset" text NOT NULL,
	"target_stocks" smallint NOT NULL,
	"target_bonds" smallint NOT NULL,
	"target_cash" smallint NOT NULL,
	"goal_amount" numeric(14, 2) NOT NULL,
	"forecast_rate" numeric(5, 2) DEFAULT '16.00' NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_single_row" CHECK ("portfolio"."id" = 1),
	CONSTRAINT "portfolio_targets_sum_100" CHECK ("portfolio"."target_stocks" + "portfolio"."target_bonds" + "portfolio"."target_cash" = 100),
	CONSTRAINT "portfolio_targets_range" CHECK ("portfolio"."target_stocks" between 0 and 100 and "portfolio"."target_bonds" between 0 and 100 and "portfolio"."target_cash" between 0 and 100),
	CONSTRAINT "portfolio_goal_positive" CHECK ("portfolio"."goal_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"instrument_id" integer NOT NULL,
	"month" date NOT NULL,
	"price" numeric(18, 6) NOT NULL,
	CONSTRAINT "prices_instrument_month_unique" UNIQUE("instrument_id","month"),
	CONSTRAINT "prices_price_positive" CHECK ("prices"."price" > 0),
	CONSTRAINT "prices_month_first_day" CHECK (extract(day from "prices"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"kind" "tx_kind" NOT NULL,
	"instrument_id" integer,
	"quantity" numeric(18, 6),
	"price" numeric(18, 6),
	"amount" numeric(14, 2) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "transactions_instrument_by_kind" CHECK (("transactions"."kind" = 'deposit' and "transactions"."instrument_id" is null) or ("transactions"."kind" <> 'deposit' and "transactions"."instrument_id" is not null)),
	CONSTRAINT "transactions_buy_has_qty_price" CHECK ("transactions"."kind" <> 'buy' or ("transactions"."quantity" > 0 and "transactions"."price" > 0))
);
--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;