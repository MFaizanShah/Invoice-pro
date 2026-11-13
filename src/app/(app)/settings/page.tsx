import { createClient } from "@/lib/supabase/server";
import { normaliseSettings, type Service } from "@/lib/types";
import SettingsForm from "@/components/SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = createClient();
  const [{ data: s }, { data: services }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("services").select("*").order("name"),
  ]);
  const list = ((services ?? []) as Service[]).map((x) => ({ ...x, unit_price: Number(x.unit_price) }));
  return <SettingsForm initial={normaliseSettings(s)} services={list} />;
}
