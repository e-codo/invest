import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Деньги хранятся целыми копейками (bigint, mode number: до 90 трлн ₽ влезает в Number).
const kopecks = (name: string) => bigint(name, { mode: "number" });

/** Пользователь. Пароль только в виде хэша с солью (см. src/lib/password.ts). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("users_email_unique").on(t.email)],
);

/** Настройки пользователя: одна строка на человека. */
export const settings = pgTable(
  "settings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    quote: text("quote").notNull(),
    planKopecks: kopecks("plan_kopecks").notNull(),
    goalKopecks: kopecks("goal_kopecks").notNull(),
    strategyEnabled: boolean("strategy_enabled").notNull().default(true),
    /** null: имя собирается из долей само. */
    strategyName: text("strategy_name"),
  },
  (t) => [
    check("settings_plan_positive", sql`${t.planKopecks} > 0`),
    check("settings_goal_positive", sql`${t.goalKopecks} > 0`),
  ],
);

/** Активы («корзины» для взносов). Не больше 5 на пользователя, это проверяет приложение. */
export const assets = pgTable(
  "assets",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Доля в стратегии, %. 0: вне стратегии. */
    weight: smallint("weight").notNull().default(0),
    position: smallint("position").notNull().default(0),
  },
  (t) => [
    index("assets_user_idx").on(t.userId),
    check("assets_weight_range", sql`${t.weight} between 0 and 100`),
  ],
);

/** Вехи: суммы, которые хочется отметить по пути к цели. */
export const milestones = pgTable(
  "milestones",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountKopecks: kopecks("amount_kopecks").notNull(),
  },
  (t) => [
    unique("milestones_user_amount_unique").on(t.userId, t.amountKopecks),
    check("milestones_amount_positive", sql`${t.amountKopecks} > 0`),
  ],
);

/** Взнос: одна дата, суммы по активам лежат в contribution_items. В месяце их может быть несколько. */
export const contributions = pgTable(
  "contributions",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
  },
  (t) => [index("contributions_user_date_idx").on(t.userId, t.date)],
);

export const contributionItems = pgTable(
  "contribution_items",
  {
    id: serial("id").primaryKey(),
    contributionId: integer("contribution_id")
      .notNull()
      .references(() => contributions.id, { onDelete: "cascade" }),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    amountKopecks: kopecks("amount_kopecks").notNull(),
  },
  (t) => [
    unique("contribution_items_unique").on(t.contributionId, t.assetId),
    check("contribution_items_amount_positive", sql`${t.amountKopecks} > 0`),
  ],
);

/** Стоимость портфеля из приложения брокера: одна на месяц. month это ГГГГ-ММ. */
export const portfolioValues = pgTable(
  "portfolio_values",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    amountKopecks: kopecks("amount_kopecks").notNull(),
  },
  (t) => [
    unique("portfolio_values_user_month_unique").on(t.userId, t.month),
    check("portfolio_values_amount_positive", sql`${t.amountKopecks} > 0`),
    check("portfolio_values_month_format", sql`${t.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  ],
);

/** Купон: доход портфеля. Во «вложено своих» не входит. */
export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    amountKopecks: kopecks("amount_kopecks").notNull(),
  },
  (t) => [index("coupons_user_date_idx").on(t.userId, t.date), check("coupons_amount_positive", sql`${t.amountKopecks} > 0`)],
);

/** Реинвест купонов: влияет на аллокацию выбранного актива, но не на «вложено своих». */
export const reinvests = pgTable(
  "reinvests",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    amountKopecks: kopecks("amount_kopecks").notNull(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
  },
  (t) => [index("reinvests_user_date_idx").on(t.userId, t.date), check("reinvests_amount_positive", sql`${t.amountKopecks} > 0`)],
);

/** Неудачные попытки входа и регистрации: по ним ограничивается перебор (см. src/lib/throttle.ts). */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: serial("id").primaryKey(),
    /** "login" или "register". */
    kind: text("kind").notNull(),
    /** Адрес клиента или почта: ограничение считается по обоим. */
    subject: text("subject").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_attempts_lookup_idx").on(t.kind, t.subject, t.at)],
);
