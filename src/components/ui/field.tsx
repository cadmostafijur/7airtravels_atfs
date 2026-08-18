import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20",
        className,
      )}
      {...props}
    />
  );
}
