"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import clsx from "clsx";

type Kind = "ok" | "err";
interface Toast { id: number; kind: Kind; text: string }

const Ctx = createContext<(kind: Kind, text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: Kind, text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => dismiss(id), kind === "err" ? 8000 : 3500);
  }, [dismiss]);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === "err" ? "alert" : "status"}
            className={clsx("toast-in pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg px-4 py-3 text-sm shadow-pop",
              t.kind === "ok" ? "bg-ink-900 text-white" : "bg-late-600 text-white")}>
            {t.kind === "ok" ? <CheckCircle2 size={17} className="mt-px shrink-0 text-brand-300" /> : <AlertCircle size={17} className="mt-px shrink-0" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100"><X size={15} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
