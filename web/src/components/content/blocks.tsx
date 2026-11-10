import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RichText } from "./rich-text";
import type { SectionId } from "@/lib/room/tasks";

export const SECTIONS: { id: SectionId; nr: number; title: string; short: string }[] = [
  { id: "grundlagen", nr: 1, title: "Grundlagen: Benutzer, UID und Gruppen", short: "Grundlagen" },
  { id: "dateien", nr: 2, title: "/etc/passwd, /etc/shadow, /etc/group", short: "Dateien" },
  { id: "befehle", nr: 3, title: "Befehle mit wichtigen Parametern", short: "Befehle" },
  { id: "pruefen", nr: 4, title: "Prüfen und Ändern: id, groups, chown, chgrp", short: "Prüfen" },
  { id: "ablauf", nr: 5, title: "Ablauf, Sperren, sudo und minimale Rechte", short: "Sicherheit" },
  { id: "demo", nr: 6, title: "Praktische Demonstration", short: "Demo" },
  { id: "uebersicht", nr: 7, title: "Befehlsübersicht", short: "Übersicht" },
];

export function Section({ id, children, lead }: { id: SectionId; children: React.ReactNode; lead?: string }) {
  const meta = SECTIONS.find((s) => s.id === id)!;
  return (
    <section id={id} data-section={id} className="scroll-mt-12 border-b border-foreground/10 py-12">
      <p className="font-mono text-base text-primary">Abschnitt {meta.nr}</p>
      <h2 className="mt-1 text-4xl font-bold leading-tight">{meta.title}</h2>
      {lead && (
        <p className="mt-4 text-xl text-foreground/60">
          <RichText text={lead} />
        </p>
      )}
      <div className="mt-8 flex flex-col gap-6">{children}</div>
    </section>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 text-2xl font-semibold">{children}</h3>;
}

export function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-lg leading-relaxed", className)}>{children}</p>;
}

/** Codeblock: Zeilen mit "$ " am Anfang werden als Eingabe hervorgehoben. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <figure className="overflow-hidden rounded-base border border-foreground/10">
      {label && <figcaption className="border-b border-foreground/10 px-4 py-2 text-sm text-foreground/60">{label}</figcaption>}
      <pre className="overflow-x-auto p-4 font-mono text-base leading-relaxed">
        {code.split("\n").map((line, i) => (
          <div key={i}>
            {line.startsWith("$ ") ? (
              <>
                <span className="select-none text-primary">$ </span>
                {line.slice(2)}
              </>
            ) : (
              <span className="text-foreground/60">{line || " "}</span>
            )}
          </div>
        ))}
      </pre>
    </figure>
  );
}

/** Beispielzeile, deren Felder farbig nummeriert werden, plus Erklärungstabelle. */
export function FieldTable({ line, fields }: { line: string; fields: [string, string][] }) {
  const parts = line.split(":");
  return (
    <div className="flex flex-col gap-3">
      <pre className="overflow-x-auto rounded-base border border-foreground/10 p-4 font-mono text-lg">
        {parts.map((p, i) => (
          <span key={i}>
            <span className="rounded-base px-1 hover:bg-primary/20" title={fields[i]?.[0]}>
              <sup className="mr-1 text-xs text-primary">{i + 1}</sup>
              {p || "∅"}
            </span>
            {i < parts.length - 1 && <span className="text-foreground/60">:</span>}
          </span>
        ))}
      </pre>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Nr.</TableHead>
            <TableHead>Feld</TableHead>
            <TableHead>Bedeutung</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map(([name, desc], i) => (
            <TableRow key={name}>
              <TableCell className="font-mono text-primary">{i + 1}</TableCell>
              <TableCell className="font-semibold">{name}</TableCell>
              <TableCell>
                <RichText text={desc} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function KeyPoint({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "warn" }) {
  return (
    <div className={cn("rounded-base border p-4", tone === "warn" ? "border-destructive/60" : "border-primary/60")}>
      <p className={cn("text-lg font-semibold", tone === "warn" ? "text-destructive" : "text-primary")}>{title}</p>
      <div className="mt-2 text-lg leading-relaxed">{children}</div>
    </div>
  );
}
