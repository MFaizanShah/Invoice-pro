"use client";

import { useEffect, useRef, useState } from "react";
import { money, moneyCompact } from "@/lib/format";
import type { MonthPoint } from "@/lib/analytics";

const BILLED = "#00889C";
const COLLECTED = "#B47F20";
const H = 260;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };

function niceMax(v: number) {
  if (v <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 0.25 : n <= 2 ? 0.5 : n <= 5 ? 1.25 : 2.5;
  return Math.ceil(v / (step * pow)) * step * pow;
}

// Column with a rounded data end and a square foot on the baseline.
function column(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export default function RevenueChart({ data, currency }: { data: MonthPoint[]; currency: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(el.clientWidth, 280));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(...data.map((d) => Math.max(d.billed, d.collected)), 0));
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / data.length;
  const barW = Math.max(3, Math.min(20, (band - 10) / 2));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const empty = data.every((d) => d.billed === 0 && d.collected === 0);
  const labelEvery = band < 34 ? 2 : 1;
  const point = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-5 text-[13px] text-ink-600">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BILLED }} /> Billed</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLLECTED }} /> Collected</span>
      </div>

      <div ref={wrap} className="relative" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={H} role="img" aria-label="Billed and collected amounts for each of the last 12 months" className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#BAC3BC" : "#E9ECE7"} strokeWidth={1} />
              <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" fontSize={11.5} fill="#6A7672" style={{ fontVariantNumeric: "tabular-nums" }}>
                {moneyCompact(t, currency).replace(/^[A-Z]{2,3}\s?/, "")}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            return (
              <g key={d.key}>
                {hover === i && <rect x={PAD.left + band * i + 2} y={PAD.top} width={band - 4} height={innerH} rx={4} fill="#16211F" opacity={0.045} />}
                <path d={column(cx - barW - 1, y(d.billed), barW, y(0) - y(d.billed))} fill={BILLED} />
                <path d={column(cx + 1, y(d.collected), barW, y(0) - y(d.collected))} fill={COLLECTED} />
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 9} textAnchor="middle" fontSize={11.5} fill={hover === i ? "#16211F" : "#6A7672"}>{d.label}</text>
                )}
                <rect x={PAD.left + band * i} y={PAD.top} width={band} height={innerH + PAD.bottom} fill="transparent"
                  tabIndex={0} aria-label={`${d.label}: billed ${money(d.billed, currency)}, collected ${money(d.collected, currency)}`}
                  onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} style={{ outline: "none" }} />
              </g>
            );
          })}
        </svg>

        {empty && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-6 text-center text-sm text-ink-500">
            Nothing billed in the last 12 months. Sent invoices will show here.
          </p>
        )}

        {point && hover !== null && (
          <div className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-[13px] shadow-pop"
            style={{ left: Math.min(Math.max(PAD.left + band * hover + band / 2 - 88, 0), width - 176) }}>
            <p className="mb-1.5 font-semibold text-ink-900">{point.label} {point.key.slice(0, 4)}</p>
            <p className="flex items-center justify-between gap-3 text-ink-600">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: BILLED }} />Billed</span>
              <span className="num font-medium text-ink-900">{money(point.billed, currency)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between gap-3 text-ink-600">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: COLLECTED }} />Collected</span>
              <span className="num font-medium text-ink-900">{money(point.collected, currency)}</span>
            </p>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Billed and collected by month</caption>
        <thead><tr><th>Month</th><th>Billed</th><th>Collected</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.key}><td>{d.key}</td><td>{money(d.billed, currency)}</td><td>{money(d.collected, currency)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
