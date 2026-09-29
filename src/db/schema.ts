import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const assetClass = pgEnum("asset_class", ["stocks", "bonds", "cash"]);
export const txKind = pgEnum("tx_kind", ["deposit", "buy", "income"]);

/** Настройки портфеля. Всегда одна строка (id = 1): приложение для одного человека. */
export const portfolio = pgTable(
  "portfolio",
  {
    id: smallint("id").primaryKey().default(1),
    title: text("title").notNull().default("Моя стройка фундамента"),
    subtitle: text("subtitle").notNull().default("Строю надёжно. Строю по плану. Без спешки."),
    quote: text("quote")
      .notNull()
      .default("«Большие стены складываются из маленьких кирпичей, если класть их регулярно»"),
    strategyPreset: text("strategy_preset").notNull(),
    targetStocks: smallint("target_stocks").notNull(),
    targetBonds: smallint("target_bonds").notNull(),
    targetCash: smallint("target_cash").notNull(),
    goalAmount: numeric("goal_amount", { precision: 14, scale: 2 }).notNull(),
    /** Ожидаемая доходность для прогноза, % годовых. */
    forecastRate: numeric("forecast_rate", { precision: 5, scale: 2 }).notNull().default("16.00"),
    /** Ежемесячный взнос в прогнозе, ₽. null: считать по средним взносам из истории. */
    forecastMonthly: numeric("forecast_monthly", { precision: 14, scale: 2 }),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("portfolio_single_row", sql`${t.id} = 1`),
    check(
      "portfolio_targets_sum_100",
      sql`${t.targetStocks} + ${t.targetBonds} + ${t.targetCash} = 100`,
    ),
    check(
      "portfolio_targets_range",
      sql`${t.targetStocks} between 0 and 100 and ${t.targetBonds} between 0 and 100 and ${t.targetCash} between 0 and 100`,
    ),
    check("portfolio_goal_positive", sql`${t.goalAmount} > 0`),
  ],
);

/** Вехи: суммы, которые хочется отметить по пути к цели. */
export const milestones = pgTable(
  "milestones",
  {
    id: serial("id").primaryKey(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [unique("milestones_amount_unique").on(t.amount), check("milestones_amount_positive", sql`${t.amount} > 0`)],
);

/** Фонды и бумаги, которыми владеет пользователь. */
export const instruments = pgTable(
  "instruments",
  {
    id: serial("id").primaryKey(),
    ticker: text("ticker").notNull(),
    name: text("name").notNull(),
    assetClass: assetClass("asset_class").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("instruments_ticker_unique").on(t.ticker)],
);

/**
 * Операции. deposit: взнос на счёт. buy: покупка бумаги. income: купон или дивиденд.
 * Реинвест купона это две записи: income и buy в тот же день.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    kind: txKind("kind").notNull(),
    instrumentId: integer("instrument_id").references(() => instruments.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 18, scale: 6 }),
    price: numeric("price", { precision: 18, scale: 6 }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("transactions_amount_positive", sql`${t.amount} > 0`),
    check(
      "transactions_instrument_by_kind",
      sql`(${t.kind} = 'deposit' and ${t.instrumentId} is null) or (${t.kind} <> 'deposit' and ${t.instrumentId} is not null)`,
    ),
    check(
      "transactions_buy_has_qty_price",
      sql`${t.kind} <> 'buy' or (${t.quantity} > 0 and ${t.price} > 0)`,
    ),
  ],
);

/** Цена бумаги, которую пользователь ввёл при ежемесячной отметке. month это первое число месяца. */
export const prices = pgTable(
  "prices",
  {
    id: serial("id").primaryKey(),
    instrumentId: integer("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    month: date("month", { mode: "string" }).notNull(),
    price: numeric("price", { precision: 18, scale: 6 }).notNull(),
  },
  (t) => [
    unique("prices_instrument_month_unique").on(t.instrumentId, t.month),
    check("prices_price_positive", sql`${t.price} > 0`),
    check("prices_month_first_day", sql`extract(day from ${t.month}) = 1`),
  ],
);

/** Неудачные попытки входа: по ним ограничивается перебор пароля (см. src/lib/login-throttle.ts). */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    ip: text("ip").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_ip_at_idx").on(t.ip, t.at)],
);
