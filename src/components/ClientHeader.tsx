"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
import type { Client } from "@/lib/types";
import { ClientForm, toForm } from "./ClientsManager";

export default function ClientHeader({ client }: { client: Client }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/clients" className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 hover:text-ink-900"><ChevronLeft size={14} /> Clients</Link>
          <h1 className="page-title truncate">{client.name}</h1>
          <p className="mt-1 text-sm text-ink-600">{[client.email, client.phone].filter(Boolean).join(", ") || "No contact details yet"}</p>
          {client.address && <p className="mt-0.5 whitespace-pre-line text-sm text-ink-500">{client.address}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setEditing(true)}><Pencil size={15} /> Edit details</button>
          <Link href={`/invoices/new?client=${client.id}`} className="btn-primary"><Plus size={16} /> New invoice</Link>
        </div>
      </header>
      {editing && <ClientForm initial={toForm(client)} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); router.refresh(); }} />}
      {client.notes && !editing && <p className="card whitespace-pre-line border-brass-200 bg-brass-50 p-4 text-sm text-ink-800">{client.notes}</p>}
    </div>
  );
}
