import { Dashboard } from "@/components/dashboard/dashboard";
import { todayEkb } from "@/lib/dates";
import { loadState } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await requireUser();
  const state = await loadState(userId);
  return <Dashboard state={state} today={todayEkb()} />;
}
