// Состояние, которое сервер отдаёт экранам. Суммы в рублях (число, до копеек), id строками.
export type Asset = { id: string; name: string; weight: number };
export type Deposit = { id: string; date: string; amounts: Record<string, number> };
export type Coupon = { id: string; date: string; amount: number };
export type Reinvest = { id: string; date: string; amount: number; assetId: string };

export type MonthRecord = {
  deposits: Deposit[];
  value: number | null;
  valueDate: string | null;
  coupons: Coupon[];
  reinvests: Reinvest[];
};

export type AppState = {
  texts: { title: string; subtitle: string; quote: string };
  plan: number;
  goal: number;
  milestones: number[];
  strategy: { enabled: boolean; name: string | null };
  assets: Asset[];
  /** Ключ ГГГГ-ММ. */
  months: Record<string, MonthRecord>;
};

export const MAX_ASSETS = 5;
