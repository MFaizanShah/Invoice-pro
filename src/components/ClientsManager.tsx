"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import type { Client } from "@/lib/types";
import { useToast } from "./Toast";

export interface ClientRow extends Client { invoices: number; billed: number; outstanding: number }

const empty = { id: "", name: "", email: "", phone: "", address: "", notes: "" };
type Form = typeof empty;

export function ClientForm({ initial, onDone, onCancel }: { initial: Form; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Enter the client's name."); return; }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError("That email address does not look right."); return; }
    setBusy(true); setError("");
    const supabase = createClient();
    const payload = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), address: form.address.trim(), notes: form.notes.trim() };
    const { error } = form.id
      ? await supabase.from("clients").update(payload).eq("id", form.id)
      : await supabase.from("clients").insert(payload);
    setBusy(false);
    if (error) { setError(error.message); return; }
    toast("ok", form.id ? "Client saved" : "Client added");
    onDone();
  }

  return (
    <form onSubmit={save} className="card p-6">
      <h2 className="section-title mb-4">{form.id ? "Edit client" : "New client"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="c-name">Name</label><input id="c-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
        <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label" htmlFor="c-phone">Phone</label><input id="c-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="label" htmlFor="c-address">Billing address</label><textarea id="c-address" className="input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="c-notes">Private notes</label><textarea id="c-notes" className="input" rows={2} placeholder="Only you see these. They never print on an invoice." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-late-600">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} {form.id ? "Save client" : "Add client"}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export const toForm = (c: Client): Form => ({ id: c.id, name: c.name, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" });

export default function ClientsManager({ clients, currency }: { clients: ClientRow[]; currency: string }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? clients.filter((c) => [c.name, c.email, c.phone].some((v) => (v ?? "").toLowerCase().includes(term))) : clients;
  }, [clients, q]);

  async function remove(c: ClientRow) {
    const note = c.invoices ? ` Their ${c.invoices} invoice${c.invoices === 1 ? "" : "s"} will stay on file with no client.` : "";
    if (!window.confirm(`Delete ${c.name}?${note}`)) return;
    const { error } = await createClient().from("clients").delete().eq("id", c.id);
    if (error) { toast("err", error.message); return; }
    toast("ok", `${c.name} deleted`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="mt-1 text-sm text-ink-500">{clients.length} on file</p>
        </div>
        <button className="btn-primary" onClick={() => setForm({ ...empty })}><Plus size={16} /> Add client</button>
      </header>

      {form && <ClientForm key={form.id || "new"} initial={form} onCancel={() => setForm(null)} onDone={() => { setForm(null); router.refresh(); }} />}

      <div className="card overflow-hidden">
        <div className="border-b border-ink-200 p-3">
          <div className="relative sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Name, email or phone" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr><th className="th">Client</th><th className="th">Contact</th><th className="th text-right">Invoices</th><th className="th text-right">Billed</th><th className="th text-right">Owes</th><th className="th w-24" /></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.length === 0 && (
                <tr><td colSpan={6} className="td py-14 text-center text-ink-500">
                  {clients.length === 0 ? "No clients yet. Add the first one to start invoicing." : "No client matches that search."}
                </td></tr>
              )}
              {shown.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-ink-50">
                  <td className="td font-semibold"><Link href={`/clients/${c.id}`} className="hover:underline">{c.name}</Link></td>
                  <td className="td text-ink-600"><p>{c.email}</p>{c.phone && <p className="text-[13px] text-ink-500">{c.phone}</p>}</td>
                  <td className="td num text-right text-ink-600">{c.invoices}</td>
                  <td className="td num text-right">{money(c.billed, currency)}</td>
                  <td className={`td num text-right font-semibold ${c.outstanding > 0 ? "text-ink-900" : "text-ink-300"}`}>{money(c.outstanding, currency)}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900" onClick={() => setForm(toForm(c))} aria-label={`Edit ${c.name}`}><Pencil size={15} /></button>
                      <button className="rounded p-1.5 text-ink-400 hover:bg-late-50 hover:text-late-600" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
