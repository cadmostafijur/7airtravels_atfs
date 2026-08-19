import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { requireApiSession } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { buildReport, exportMatrix } from "@/lib/attendance/reports";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "reports");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "csv";
    const report = await buildReport({
      type: searchParams.get("type") ?? "daily",
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
      const sheet = workbook.addWorksheet("Attendance");
      sheet.addRow(header);
      rows.forEach((line) => sheet.addRow(line));
      const buffer = await workbook.xlsx.writeBuffer();
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=${filename}.xlsx`,
        },
      });
    }

    if (format === "pdf") {
      const doc = await PDFDocument.create();
      let page = doc.addPage([842, 595]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      let y = 560;
      page.drawText(`7 Air Travels — ${report.type} attendance report`, { x: 40, y, size: 14, font });
      y -= 24;
      page.drawText(header.join(" | "), { x: 40, y, size: 8, font });
      y -= 14;
      for (const line of rows) {
        if (y < 40) {
          page = doc.addPage([842, 595]);
          y = 560;
        }
        page.drawText(line.join(" | ").slice(0, 140), { x: 40, y, size: 8, font });
        y -= 12;
      }
      const bytes = await doc.save();
      return new Response(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=${filename}.pdf`,
        },
      });
    }

    const csv = [header, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}.csv`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
