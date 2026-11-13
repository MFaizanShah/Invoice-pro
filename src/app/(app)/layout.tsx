import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import CommandPalette from "@/components/CommandPalette";
import { ToastProvider } from "@/components/Toast";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data } = await supabase.from("settings").select("company_name,logo_data").eq("id", 1).maybeSingle();

  return (
    <ToastProvider>
      <div className="app-shell flex min-h-screen">
        <Sidebar company={data?.company_name || "Your company"} logo={data?.logo_data || ""} />
        <main className="app-main min-w-0 flex-1 px-4 pb-28 pt-7 sm:px-8 lg:px-10 lg:pb-14">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
        <MobileNav />
        <CommandPalette />
      </div>
    </ToastProvider>
  );
}
