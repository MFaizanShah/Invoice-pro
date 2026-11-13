"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { NAV } from "./nav";

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-200 bg-white lg:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={clsx("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-brand-700" : "text-ink-500")}>
            <Icon size={20} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
