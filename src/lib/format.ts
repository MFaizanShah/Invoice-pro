export function money(n: number, currency = "FJD") {
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2 }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`;
  }
}

export function moneyCompact(n: number, currency = "FJD") {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
  } catch {
    return `${currency} ${Math.round(n || 0)}`;
  }
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function fmtLongDate(d: string | null | undefined) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Calendar date in the business time zone, so "today" and "overdue" are right
// both in the browser and on a server that runs in UTC.
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Pacific/Fiji";

export function todayISO(timeZone: string = TIME_ZONE) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string) {
  const a = Date.parse(fromISO.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(toISO.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

// "00014" style numbers: prefix plus a zero padded counter.
export const formatInvoiceNumber = (prefix: string, n: number, padding: number) =>
  `${prefix}${String(Math.max(n, 0)).padStart(Math.min(Math.max(padding, 1), 10), "0")}`;

export const uid = () => Math.random().toString(36).slice(2, 10);

// CSV with proper quoting. Cells that start with = + - @ are prefixed so a
// spreadsheet never runs them as formulas.
export function toCSV(headers: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    if (typeof v === "number") return String(v);
    let s = v ?? "";
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
