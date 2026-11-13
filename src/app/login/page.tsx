"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const domain = process.env.NEXT_PUBLIC_AUTH_DOMAIN || "invoicepro.app";
    const { error } = await createClient().auth.signInWithPassword({
      email: `${username.trim().toLowerCase()}@${domain}`,
      password,
    });
    if (error) {
      setError(error.message.toLowerCase().includes("fetch")
        ? "Supabase could not be reached. Check the URL and key in .env.local."
        : "That username and password do not match.");
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* The product itself, as the welcome: a settled invoice */}
      <section className="relative hidden overflow-hidden bg-brand-800 lg:flex lg:items-center lg:justify-center" aria-hidden="true">
        <div className="relative w-[26rem] rotate-[-4deg] rounded-sm bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,.55)]">
          <div className="h-2 bg-brand-700" />
          <div className="p-9">
            <div className="flex justify-between">
              <div className="space-y-1.5"><div className="h-3 w-28 rounded bg-ink-800" /><div className="h-2 w-36 rounded bg-ink-200" /><div className="h-2 w-24 rounded bg-ink-200" /></div>
              <p className="font-display text-2xl font-semibold text-brand-700">Invoice</p>
            </div>
            <div className="mt-8 space-y-3 border-t border-ink-200 pt-5">
              {[["Sales commission", "18,400.00"], ["Listing and marketing", "1,250.00"], ["Valuation report", "450.00"]].map(([d, a]) => (
                <div key={d} className="flex justify-between text-[13px]"><span className="text-ink-700">{d}</span><span className="num text-ink-900">{a}</span></div>
              ))}
            </div>
            <div className="mt-6 flex items-end justify-between">
              <span className="stamp inline-block border-brand-600 text-brand-600">Paid</span>
              <div className="w-44 space-y-1.5 text-[13px]">
                <div className="flex justify-between text-ink-600"><span>GST 15%</span><span className="num">3,015.00</span></div>
                <div className="flex justify-between rounded bg-brand-700 px-3 py-2 font-semibold text-white"><span>Total</span><span className="num">23,115.00</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center bg-white p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm" noValidate>
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-700 font-display text-lg font-bold text-white">I</span>
          <h1 className="mt-6 font-display text-[2rem] font-semibold leading-tight tracking-tight">Sign in to Invoice Pro</h1>
          <p className="mt-2 text-sm text-ink-600">Invoices, payments and revenue for your agency.</p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="u">Username</label>
              <input id="u" className="input py-2.5" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required />
            </div>
            <div>
              <label className="label" htmlFor="p">Password</label>
              <div className="relative">
                <input id="p" type={show ? "text" : "password"} className="input py-2.5 pr-11" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-400 hover:text-ink-800">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>
            {error && <p role="alert" className="rounded-lg bg-late-50 px-3 py-2.5 text-sm text-late-700">{error}</p>}
            <button className="btn-primary w-full py-2.5" disabled={busy || !username || !password}>
              {busy && <Loader2 size={16} className="animate-spin" />} Sign in
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
