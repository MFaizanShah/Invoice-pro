import { createClient } from "@/lib/supabase/server";
import { normaliseSettings, type Client, type Service } from "@/lib/types";
import InvoiceEditor from "@/components/InvoiceEditor";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: { client?: string } }) {
  const supabase = createClient();
  const [{ data: s }, { data: clients }, { data: services }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("clients").select("*").order("name").limit(5000),
    supabase.from("services").select("*").order("name"),
  ]);

  return (
    <InvoiceEditor
      settings={normaliseSettings(s)}
      clients={(clients ?? []) as Client[]}
      services={(services ?? []) as Service[]}
      presetClientId={searchParams.client ?? null}
    />
  );
}
