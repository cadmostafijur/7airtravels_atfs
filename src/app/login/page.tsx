"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("admin@7airtravels.local");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push(search.get("next") || "/admin/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-navy radar-grid lg:flex lg:flex-col lg:justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <Image src="/brand/logo.png" alt="7 Air Travels" width={64} height={64} className="rounded-full bg-white" />
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-teal-2">7 Air Travels Limited</div>
            <div className="text-xl font-semibold">Office Attendance Control</div>
          </div>
        </div>
        <div className="max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight">
            Fingerprint in.
            <br />
            Desk board live.
          </h1>
          <p className="mt-4 text-white/70">
            ZKTeco K50A stays on the office LAN. This console syncs attendance into PostgreSQL, updates the live board,
            and notifies three administrators by SMS.
          </p>
        </div>
        <div className="font-mono text-xs text-white/50">K50A · TCP/IP · Ethernet · Not exposed to the public internet</div>
      </section>
      <section className="flex items-center justify-center bg-paper p-6">
        <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-[0_20px_60px_rgba(6,35,45,0.08)]">
          <div className="mb-6 lg:hidden">
            <Image src="/brand/logo.png" alt="7 Air Travels" width={56} height={56} className="rounded-full" />
          </div>
          <h2 className="text-2xl font-semibold">Admin sign in</h2>
          <p className="mt-1 mb-6 text-sm text-muted">
            This website is for administrators only. Regular employees do not log in — they scan fingerprint on the K50A
            device only.
          </p>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4" required />
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mb-6" required />
          <Button className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Enter control desk"}
          </Button>
        </form>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
