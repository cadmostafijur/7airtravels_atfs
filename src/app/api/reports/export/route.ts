import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { requireApiSession } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { buildReport, exportMatrix } from "@/lib/attendance/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** Helvetica is WinAnsi-only. Punch labels use → · — which crash drawText. */
function pdfSafe(value: unknown): string {
  const text = String(value ?? "")
    .replaceAll("→", "->")
    .replaceAll("←", "<-")
    .replaceAll("·", " | ")
    .replaceAll("•", "*")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("…", "...")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"');
  return [...text]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code >= 0x20 && code <= 0x7e) return ch;
      if (code >= 0xa0 && code <= 0xff) return ch;
      if (code === 0x09 || code === 0x0a || code === 0x0d) return " ";
      return "?";
    })
    .join("");
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
      return fileResponse(
        Buffer.from(buffer),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        `${filename}.xlsx`,
      );
    }

    if (format === "pdf") {
      const doc = await PDFDocument.create();
      let page = doc.addPage([842, 595]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      let y = 560;
      page.drawText(pdfSafe(`7 Air Travels - ${report.type} attendance report`), { x: 40, y, size: 14, font });
      y -= 24;
      page.drawText(pdfSafe(header.join(" | ")), { x: 40, y, size: 8, font });
      y -= 14;
      for (const line of rows) {
        if (y < 40) {
          page = doc.addPage([842, 595]);
          y = 560;
        }
        page.drawText(pdfSafe(line.join(" | ")).slice(0, 140), { x: 40, y, size: 8, font });
        y -= 12;
      }
      const bytes = await doc.save();
      return fileResponse(Buffer.from(bytes), "application/pdf", `${filename}.pdf`);
    }

    const csv = [header, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
    return fileResponse(csv, "text/csv; charset=utf-8", `${filename}.csv`);
  } catch (error) {
    return jsonError(error);
  }
}
