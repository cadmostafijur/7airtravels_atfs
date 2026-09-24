import ExcelJS from "exceljs";
import { requireApiSession } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { buildAttendancePdf } from "@/lib/attendance/pdf";
import { buildReport, exportMatrix, type ReportQuery } from "@/lib/attendance/reports";

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

function queryFrom(searchParams: URLSearchParams, type: string): ReportQuery {
  return {
    type,
    from: searchParams.get("from") ?? new Date().toISOString(),
    to: searchParams.get("to") ?? new Date().toISOString(),
    employeeId: searchParams.get("employeeId") ?? undefined,
    departmentId: searchParams.get("departmentId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  };
}

function addSheet(workbook: ExcelJS.Workbook, name: string, header: string[], rows: string[][]) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  const head = sheet.addRow(header);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E8A96" } };
  head.alignment = { vertical: "middle", wrapText: true };
  rows.forEach((line) => sheet.addRow(line));
  sheet.columns.forEach((col, index) => {
    const label = header[index] ?? "";
    const key = label.toLowerCase();
    if (key === "punches") col.width = 42;
    else if (key === "name" || key === "employee" || key === "department") col.width = 22;
    else if (key === "in" || key === "out" || key === "status") col.width = 16;
    else if (name === "Presence" && index >= 3 && label.length <= 3) col.width = 5;
    else col.width = Math.min(28, Math.max(10, label.length + 4));
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: header.length },
  };
}

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "reports");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "csv";
    const selectedType = searchParams.get("type") ?? "daily";
    const selected = await buildReport(queryFrom(searchParams, selectedType));
    const { header, rows } = exportMatrix(selected);
    const filename = `attendance-${selected.type}`;

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "7 Air Travels ATFS";
      const daily = selected.type === "daily" ? selected : await buildReport(queryFrom(searchParams, "daily"));
      const presence = selected.type === "presence" ? selected : await buildReport(queryFrom(searchParams, "presence"));
      const raw = selected.type === "raw" ? selected : await buildReport(queryFrom(searchParams, "raw"));

      const dailyMatrix = exportMatrix(daily);
      addSheet(workbook, "Daily entries", dailyMatrix.header, dailyMatrix.rows);
      if (selected.type !== "daily" && selected.type !== "presence" && selected.type !== "raw") {
        addSheet(workbook, selected.title ?? selected.type, header, rows);
      }
      const presenceMatrix = exportMatrix(presence);
      addSheet(workbook, "Presence", presenceMatrix.header, presenceMatrix.rows);
      const rawMatrix = exportMatrix(raw);
      addSheet(workbook, "Raw punches", rawMatrix.header, rawMatrix.rows);

      const buffer = await workbook.xlsx.writeBuffer();
      return fileResponse(
        Buffer.from(buffer),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        `${filename}.xlsx`,
      );
    }

    if (format === "pdf") {
      const bytes = await buildAttendancePdf({
        type: selected.type,
        title: selected.title,
        subtitle: selected.subtitle,
        header,
        rows,
      });
      return fileResponse(bytes, "application/pdf", `${filename}.pdf`);
    }

    const csv = `\uFEFF${[header, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n")}`;
    return fileResponse(csv, "text/csv; charset=utf-8", `${filename}.csv`);
  } catch (error) {
    return jsonError(error);
  }
}
