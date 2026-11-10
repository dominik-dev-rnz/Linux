import { Fragment } from "react";
import { cn } from "@/lib/utils";

export function InlineCode({ children, className }: { children: React.ReactNode; className?: string }) {
  return <code className={cn("rounded-base bg-foreground/10 px-1 font-mono text-primary", className)}>{children}</code>;
}

/** Text mit `Code` in Backticks */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? <InlineCode key={i}>{part.slice(1, -1)}</InlineCode> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}
