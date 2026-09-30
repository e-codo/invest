import { loadState } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUser();
  const state = await loadState(userId);
  return <SettingsForm state={state} />;
}
