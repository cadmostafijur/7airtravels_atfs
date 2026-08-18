"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plane,
  Settings,
  Shield,
  Smartphone,
  Timer,
  Users,
  FileBarChart,
  FlaskConical,
  BookOpen,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Me = { name: string; email: string; role: string; simulation: boolean };

const nav = [
  { href: "/admin/dashboard", label: "Operations", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "VIEWER"] },
  { href: "/admin/attendance", label: "Attendance", icon: Fingerprint, roles: ["SUPER_ADMIN", "ADMIN", "VIEWER"] },
  { href: "/admin/employees", label: "People", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart, roles: ["SUPER_ADMIN", "ADMIN", "VIEWER"] },
  { href: "/admin/help", label: "বাংলা গাইড", icon: BookOpen, roles: ["SUPER_ADMIN", "ADMIN", "VIEWER"] },
  { href: "/admin/devices", label: "K50A Devices", icon: Smartphone, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/admin/shifts", label: "Shifts", icon: Timer, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/admin/holidays", label: "Holidays", icon: CalendarDays, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/admin/leaves", label: "Leave", icon: ClipboardList, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/admin/sms", label: "Admin SMS", icon: MessageSquare, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/admin/settings", label: "My account", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN", "VIEWER"] },
  { href: "/admin/audit-logs", label: "Audit", icon: Shield, roles: ["SUPER_ADMIN"] },
  { href: "/admin/simulation", label: "Simulation", icon: FlaskConical, roles: ["SUPER_ADMIN", "ADMIN"], sim: true },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api<Me>("/api/auth/me")
      .then(setMe)
      .catch(() => router.push("/login"));
  }, [router]);

  const items = nav.filter((item) => me && item.roles.includes(me.role) && (!item.sim || me.simulation));

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const sidebar = (
    <aside className="flex h-full w-72 flex-col bg-navy text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <Image src="/brand/logo.png" alt="7 Air Travels" width={44} height={44} className="rounded-full bg-white" />
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-teal-2">Office Control</div>
          <div className="font-semibold leading-tight">ATFS Attendance</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/75 hover:bg-white/8 hover:text-white",
                active && "bg-teal text-white shadow-lg shadow-teal/20",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-white/60">
          <Plane className="h-3.5 w-3.5" />
          <span>{me?.name ?? "…"}</span>
        </div>
        <Button variant="outline" className="w-full border-white/15 bg-transparent text-white hover:bg-white/10" onClick={logout}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-paper">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex">{sidebar}</div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-50">{sidebar}</div>
        </div>
      ) : null}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="text-sm text-muted">
            7 Air Travels Limited · Fingerprint attendance
          </div>
          <div className="rounded-full bg-paper px-3 py-1 font-mono text-xs uppercase tracking-wider text-teal">
            {me?.role?.replaceAll("_", " ")}
          </div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
