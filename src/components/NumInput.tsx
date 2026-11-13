"use client";

import { useEffect, useState } from "react";

interface Props {
  value: number;
  onChange: (n: number) => void;
  allowNegative?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  /** Shown instead of the raw number while the field is not being edited, e.g. "$900.00". */
  display?: (n: number) => string;
  "aria-label"?: string;
}

// Text backed numeric input so users can type "1." or clear the field without it snapping back.
export default function NumInput({ value, onChange, allowNegative, className, placeholder, display, ...rest }: Props) {
  const blankWhenZero = value === 0 && !!placeholder;
  const [text, setText] = useState(blankWhenZero ? "" : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const parsed = parseFloat(text);
    if ((Number.isNaN(parsed) ? 0 : parsed) !== value) setText(value === 0 && placeholder ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const shown = !focused && display && !blankWhenZero ? display(value) : text;

  return (
    <input
      {...rest}
      inputMode="decimal"
      autoComplete="off"
      className={className}
      placeholder={placeholder}
      value={shown}
      onFocus={(e) => {
        setFocused(true);
        setText(blankWhenZero ? "" : String(value));
        const el = e.currentTarget;
        window.setTimeout(() => el.select(), 0);
      }}
      onChange={(e) => {
        let cleaned = e.target.value.replace(allowNegative ? /[^0-9.\-]/g : /[^0-9.]/g, "");
        const dot = cleaned.indexOf(".");
        if (dot !== -1) cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
        setText(cleaned);
        const n = parseFloat(cleaned);
        onChange(Number.isNaN(n) ? 0 : n);
      }}
      onBlur={() => {
        setFocused(false);
        setText(value === 0 && placeholder ? "" : String(value));
      }}
    />
  );
}
