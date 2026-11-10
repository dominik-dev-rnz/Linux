"use client";
import { useEffect, useState } from "react";

function format(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** Zeigt die Laufzeit der Session seit dem Start der Maschine. */
export function SessionTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  return (
    <span className="font-mono tabular-nums" aria-label="Laufzeit der Session">
      {startedAt ? format(now - startedAt) : "00:00:00"}
    </span>
  );
}
