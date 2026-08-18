import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
  {
    variants: {
      variant: {
        default: "bg-teal text-white hover:bg-teal-2",
        navy: "bg-navy text-white hover:bg-navy-2",
        outline: "border border-line bg-white hover:bg-paper text-ink",
        ghost: "hover:bg-white/10 text-current",
        danger: "bg-signal text-white hover:bg-red-700",
        brass: "bg-brass text-navy hover:brightness-105",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
