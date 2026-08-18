import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { formatDate, formatTime, startOfZonedDay, endOfZonedDay, workDateUtc } from "@/lib/time";

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
    const from = startOfZonedDay(new Date(searchParams.get("from") ?? Date.now()));
    const to = endOfZonedDay(new Date(searchParams.get("to") ?? Date.now()));
    const rows = await prisma.dailyAttendanceSummary.findMany({
      where: { workDate: { gte: workDateUtc(from), lte: workDateUtc(to) } },
      include: { employee: { include: { department: true } } },
      orderBy: [{ workDate: "asc" }, { employee: { name: "asc" } }],
    });

    const header = [
      "Date",
      "Employee Code",
      "Name",
      "Department",
      "Status",
      "Check-in",
      "Check-out",
      "Late Minutes",
      "Early Minutes",
      "Overtime Minutes",
    ];
    const data = rows.map((row) => [
      formatDate(row.workDate),
      row.employee.employeeCode,
      row.employee.name,
      row.employee.department?.name ?? "",
      row.status,
      formatTime(row.checkInAt),
      formatTime(row.checkOutAt),
      String(row.lateMinutes),
      String(row.earlyMinutes),
      String(row.overtimeMinutes),
    ]);

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Attendance");
      sheet.addRow(header);
      data.forEach((line) => sheet.addRow(line));
      const buffer = await workbook.xlsx.writeBuffer();
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=attendance.xlsx",
        },
      });
    }

    if (format === "pdf") {
      const doc = await PDFDocument.create();
      let page = doc.addPage([842, 595]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      let y = 560;
      page.drawText("7 Air Travels — Attendance Report", { x: 40, y, size: 14, font });
      y -= 24;
      page.drawText(header.join(" | "), { x: 40, y, size: 8, font });
      y -= 14;
      for (const line of data) {
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
          "Content-Disposition": "attachment; filename=attendance.pdf",
        },
      });
    }

    const csv = [header, ...data].map((line) => line.map(csvEscape).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=attendance.csv",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
