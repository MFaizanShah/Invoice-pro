"use client";

import { useLayoutEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  "aria-label"?: string;
}

// Textarea that grows with its content, so long descriptions print in full.
export default function AutoTextarea({ value, onChange, className, minRows = 1, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea ref={ref} rows={minRows} value={value} onChange={(e) => onChange(e.target.value)}
      className={className} style={{ resize: "none", overflow: "hidden" }} {...rest} />
  );
}
