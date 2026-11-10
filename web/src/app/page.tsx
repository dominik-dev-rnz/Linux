"use client";
import { useEffect } from "react";
import { ContentSections } from "@/components/content/sections";
import { LabPanel } from "@/components/lab/lab-panel";
import { SectionNav } from "@/components/section-nav";
import { SiteHeader } from "@/components/site-header";
import { getLabStore, useLab } from "@/lib/lab-store";

export default function Home() {
  const s = useLab();

  useEffect(() => {
    getLabStore().hydrate();
  }, []);

  // Vorführmodus: das aktuelle Element ins Bild holen
  useEffect(() => {
    if (!s.focus) return;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (s.focus.id === "terminal" && desktop) return; // Terminal ist auf großen Bildschirmen immer sichtbar
    document.getElementById(s.focus.id)?.scrollIntoView({ behavior: "smooth", block: s.focus.id === "terminal" ? "end" : "center" });
  }, [s.focus]);

  return (
    <div className="min-h-screen">
      <div className="lg:grid lg:grid-cols-[11fr_9fr]">
        <main className="min-w-0 px-4 pb-12 lg:px-8">
          <SiteHeader />
          <SectionNav />
          <ContentSections />
        </main>
        <aside
          id="lab"
          aria-label="Live-Demo"
          className="no-print flex h-screen flex-col border-t border-foreground/10 bg-foreground/10 p-4 lg:sticky lg:top-0 lg:border-l lg:border-t-0 lg:p-6"
        >
          <LabPanel />
        </aside>
      </div>
    </div>
  );
}
