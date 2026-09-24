import ExcelJS from "exceljs";
import { requireApiSession } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { buildAttendancePdf } from "@/lib/attendance/pdf";
import { buildReport, exportMatrix } from "@/lib/attendance/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function fileResponse(body: BodyInit, contentType: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "reports");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "csv";
    const report = await buildReport({
      type: searchParams.get("type") ?? "presence",
      from: searchParams.get("from") ?? new Date().toISOString(),
      to: searchParams.get("to") ?? new Date().toISOString(),
      employeeId: searchParams.get("employeeId") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });
    const { header, rows } = exportMatrix(report);
    const filename = `attendance-${report.type}`;

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(report.title ?? "Attendance");
      const head = sheet.addRow(header);
      head.font = { bold: true, color: { argb: "FFFFFFFF" } };
      head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E8A96" } };
      rows.forEach((line) => sheet.addRow(line));
      sheet.columns.forEach((col, index) => {
        const label = header[index] ?? "";
        col.width = report.type === "presence" && index >= 3 && label.length <= 3 ? 4 : Math.min(28, Math.max(8, label.length + 4));
      });
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      const buffer = await workbook.xlsx.writeBuffer();
      return fileResponse(
        Buffer.from(buffer),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        `${filename}.xlsx`,
      );
    }

    if (format === "pdf") {
      const bytes = await buildAttendancePdf({
        type: report.type,
        title: report.title,
        subtitle: report.subtitle,
        header,
        rows,
      });
      return fileResponse(bytes, "application/pdf", `${filename}.pdf`);
    }

    const csv = [header, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
    return fileResponse(csv, "text/csv; charset=utf-8", `${filename}.csv`);
  } catch (error) {
    return jsonError(error);
  }
}
