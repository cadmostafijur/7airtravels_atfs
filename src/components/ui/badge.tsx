import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "ok" | "late" | "warn" | "info" | "muted";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-paper text-ink",
    ok: "bg-emerald-50 text-emerald-800",
    late: "bg-red-50 text-signal",
    warn: "bg-amber-50 text-amber-800",
    info: "bg-cyan-50 text-teal",
    muted: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function statusTone(status: string) {
  if (["PRESENT", "OVERTIME"].includes(status)) return "ok" as const;
  if (["LATE", "ABSENT"].includes(status)) return "late" as const;
  if (["EARLY_LEAVE", "HALF_DAY"].includes(status)) return "warn" as const;
  if (["LEAVE", "HOLIDAY"].includes(status)) return "info" as const;
  return "muted" as const;
}
