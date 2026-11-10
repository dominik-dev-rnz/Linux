import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-base border px-2 py-1 text-sm font-medium [&_svg]:size-4", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-background",
      secondary: "border-transparent bg-foreground/10 text-foreground",
      outline: "border-foreground/20 text-foreground",
      success: "border-primary/60 text-primary",
      destructive: "border-destructive/60 text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
