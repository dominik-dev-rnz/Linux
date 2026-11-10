"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button size="lg" onClick={() => window.print()} data-testid="print">
      <Printer /> Drucken / als PDF speichern
    </Button>
  );
}
