"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-16 max-w-lg p-8 text-center">
      <h1 className="section-title text-xl">This page could not load</h1>
      <p className="mt-2 text-sm text-ink-600">{error.message || "An unexpected error occurred."}</p>
      <p className="mt-1 text-[13px] text-ink-500">If this keeps happening, check that supabase/schema.sql has been run on your project.</p>
      <button className="btn-primary mt-6" onClick={reset}>Try again</button>
    </div>
  );
}
