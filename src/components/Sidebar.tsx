"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Plus, Search } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { NAV, OPEN_PALETTE } from "./nav";

export default function Sidebar({ company, logo }: { company: string; logo: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-ink-200 bg-white px-3 py-5 max-lg:hidden">
      <div className="flex items-center gap-3 px-2 pb-5">
        {logo
          ? <img src={logo} alt="" className="h-9 w-9 rounded-md object-contain" />
          : <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-700 font-display text-base font-bold text-white">{company.slice(0, 1).toUpperCase()}</span>}
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-semibold leading-tight">{company}</p>
          <p className="text-xs text-ink-500">Invoice Pro</p>
        </div>
      </div>

      <Link href="/invoices/new" className="btn-primary mb-2 w-full"><Plus size={16} /> New invoice</Link>
      <button onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
        className="mb-4 flex w-full items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800">
        <Search size={15} /> <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 text-[11px] font-medium text-ink-500">Ctrl K</kbd>
      </button>

      <nav className="space-y-0.5" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={clsx("relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand-50 text-brand-800" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900")}>
              {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand-700" />}
              <Icon size={17} /> {label}
            </Link>
          );
        })}
      </nav>

      <button onClick={signOut} className="mt-auto flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900">
        <LogOut size={17} /> Sign out
      </button>
    </aside>
  );
}
