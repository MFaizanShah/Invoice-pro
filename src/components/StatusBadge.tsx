import clsx from "clsx";
import type { EffectiveStatus } from "@/lib/calc";

const styles: Record<EffectiveStatus, string> = {
  draft: "bg-ink-100 text-ink-600",
  sent: "bg-brand-50 text-brand-700",
  partial: "bg-brass-50 text-brass-700",
  paid: "bg-brand-700 text-white",
  overdue: "bg-late-50 text-late-600",
  void: "bg-ink-100 text-ink-400 line-through",
};

export const statusLabels: Record<EffectiveStatus, string> = {
  draft: "Draft", sent: "Awaiting payment", partial: "Part paid", paid: "Paid", overdue: "Overdue", void: "Void",
};

export default function StatusBadge({ status }: { status: EffectiveStatus }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold", styles[status])}>
      {statusLabels[status]}
    </span>
  );
}
