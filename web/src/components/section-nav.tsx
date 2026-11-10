"use client";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SECTIONS } from "@/components/content/blocks";
import { countDone, TOTAL_QUESTIONS, useLab } from "@/lib/lab-store";
import { cn } from "@/lib/utils";

/** Sticky-Navigation mit Abschnitten und Gesamtfortschritt */
export function SectionNav() {
  const s = useLab();
  const done = countDone(s.questions);
  const [active, setActive] = useState<string>("grundlagen");

  useEffect(() => {
    // Der Observer meldet nur Änderungen, deshalb den Sichtbarkeitsstand selbst merken
    const visible = new Map<string, boolean>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const first = SECTIONS.find((sec) => visible.get(sec.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    document.querySelectorAll("[data-section]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <nav aria-label="Abschnitte" className="no-print sticky top-0 z-10 -mx-4 border-b border-foreground/10 bg-background px-4 py-3 lg:-mx-8 lg:px-8">
      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-3">
          <Progress value={(done / TOTAL_QUESTIONS) * 100} aria-label="Gesamtfortschritt" />
          <span className="whitespace-nowrap font-mono text-base" data-testid="progress-text">
            {done}/{TOTAL_QUESTIONS} Aufgaben
          </span>
        </div>
        {done === TOTAL_QUESTIONS && (
          <Badge>
            <Trophy /> Room completed
          </Badge>
        )}
      </div>
      <ul className="mt-3 flex gap-1 overflow-x-auto">
        {SECTIONS.map((sec) => (
          <li key={sec.id}>
            <a
              href={`#${sec.id}`}
              className={cn(
                "block whitespace-nowrap rounded-base px-3 py-1 text-base transition-colors hover:bg-foreground/10",
                active === sec.id ? "bg-foreground/10 text-primary" : "text-foreground/60",
              )}
            >
              <span className="font-mono">{sec.nr}</span> {sec.short}
            </a>
          </li>
        ))}
        <li className="lg:hidden">
          <a href="#lab" className="block whitespace-nowrap rounded-base px-3 py-1 text-base text-primary hover:bg-foreground/10">
            Terminal ↓
          </a>
        </li>
      </ul>
    </nav>
  );
}
