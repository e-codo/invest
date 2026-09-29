export type Allocation = { stocks: number; bonds: number; cash: number };

export const PRESETS = [
  {
    key: "conservative",
    name: "Консервативная",
    hint: "Больше облигаций и ликвидности, спокойный рост",
    stocks: 20,
    bonds: 60,
    cash: 20,
  },
  {
    key: "moderate",
    name: "Умеренная",
    hint: "Баланс между ростом и устойчивостью",
    stocks: 40,
    bonds: 50,
    cash: 10,
  },
  {
    key: "aggressive",
    name: "Агрессивная",
    hint: "Упор на акции, просадки будут заметнее",
    stocks: 70,
    bonds: 25,
    cash: 5,
  },
] as const;

export type PresetKey = (typeof PRESETS)[number]["key"];
export type StrategyKey = PresetKey | "custom";

export const STRATEGY_KEYS = ["conservative", "moderate", "aggressive", "custom"] as const;

export const ASSET_CLASSES = [
  { key: "stocks", name: "Акции", color: "var(--stocks)" },
  { key: "bonds", name: "Облигации", color: "var(--bonds)" },
  { key: "cash", name: "Ликвидность", color: "var(--cash)" },
] as const;

export type AssetClassKey = (typeof ASSET_CLASSES)[number]["key"];

export function assetClassName(key: AssetClassKey): string {
  return ASSET_CLASSES.find((c) => c.key === key)?.name ?? key;
}

export function strategyName(key: string): string {
  if (key === "custom") return "Своя стратегия";
  return PRESETS.find((p) => p.key === key)?.name ?? key;
}
