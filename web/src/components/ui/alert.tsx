import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-base border px-4 py-3 text-base [&>svg]:size-6 [&>svg]:translate-y-0", {
  variants: {
    variant: {
      default: "border-foreground/20 text-foreground",
      success: "border-primary/60 text-foreground [&>svg]:text-primary",
      destructive: "border-destructive/60 text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("col-start-2 font-semibold", className)} {...props} />;
}
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("col-start-2 text-foreground/60", className)} {...props} />;
}
export { Alert, AlertTitle, AlertDescription };
