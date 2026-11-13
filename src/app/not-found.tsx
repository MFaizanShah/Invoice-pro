import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="text-center">
        <p className="font-display text-6xl font-semibold text-brand-700">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">That page does not exist</h1>
        <p className="mt-2 text-sm text-ink-600">The invoice or client may have been deleted.</p>
        <Link href="/dashboard" className="btn-primary mt-6">Go to the dashboard</Link>
      </div>
    </main>
  );
}
