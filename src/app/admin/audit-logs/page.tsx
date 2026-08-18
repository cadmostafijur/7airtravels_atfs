"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/time";

type Log = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  ipAddress: string | null;
  admin: { name: string; email: string } | null;
};

export default function AuditPage() {
  const [rows, setRows] = useState<Log[]>([]);
  useEffect(() => {
    api<Log[]>("/api/audit-logs").then(setRows);
  }, []);

  return (
    <div>
      <PageHeader eyebrow="Security" title="Audit log" />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Admin</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3 font-mono text-xs">{formatDateTime(row.createdAt)}</td>
                  <td className="px-5 py-3">{row.admin?.name ?? "system"}</td>
                  <td className="px-5 py-3">{row.action}</td>
                  <td className="px-5 py-3">
                    {row.entity} {row.entityId}
                  </td>
                  <td className="px-5 py-3">{row.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
