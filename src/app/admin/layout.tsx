import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { getSessionAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/login");

  return <AdminShell>{children}</AdminShell>;
}
