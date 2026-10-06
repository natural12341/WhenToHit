'use client';

import { useEffect, useState } from 'react';

/** Числовое поле: пока печатаешь — не мешает, при выходе из поля приводит к диапазону */
export default function NumInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}) {
  const [s, setS] = useState(String(value));
  useEffect(() => setS(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(s));
    const v = Number.isFinite(n) && n > 0 ? Math.max(min, Math.min(max, n)) : value;
    setS(String(v));
    if (v !== value) onCommit(v);
  };
  return (
    <input
      className="input"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={s}
      onChange={(e) => setS(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}
