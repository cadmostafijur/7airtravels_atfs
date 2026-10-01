import ExcelJS from "exceljs";
import { requireApiSession } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { buildAttendancePdf } from "@/lib/attendance/pdf";
import { formatHours } from "@/lib/hours";
import { buildMonthlyPayroll, currentPayrollMonth } from "@/lib/payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "payroll");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "csv";
    const month = searchParams.get("month") || currentPayrollMonth();
    const report = await buildMonthlyPayroll(month);
    const header = [
      "Employee",
      "Code",
      "Department",
      "Base salary",
      "Working days",
      "Penalty per day",
      "Present",
      "Late hours",
      "Absent",
      "Absent fine",
      "Adjusted salary",
      "Status",
    ];
    const rows = report.rows.map((row) => [
      row.name,
      row.employeeCode,
      row.department,
      String(row.monthlySalary),
      String(row.workingDays),
      String(row.dailyPenalty),
      String(row.presentDays),
      formatHours(row.lateMinutes),
      String(row.absentDays),
      String(row.absentFine),
      String(row.adjustedSalary),
      row.status,
    ]);
    rows.push([
      "TOTAL",
      "",
      "",
      String(report.totals.monthlySalary),
      "",
      "",
      "",
      formatHours(report.totals.lateMinutes),
      String(report.totals.absentDays),
      String(report.totals.absentFine),
      String(report.totals.adjustedSalary),
      "",
    ]);
    const filename = `payroll-${month}`;

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Payroll");
      const head = sheet.addRow(header);
      head.font = { bold: true, color: { argb: "FFFFFFFF" } };
      head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E8A96" } };
      rows.forEach((line) => sheet.addRow(line));
      sheet.columns.forEach((col) => {
        col.width = 16;
      });
      const buffer = await workbook.xlsx.writeBuffer();
      return new Response(Buffer.from(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    if (format === "pdf") {
      const bytes = await buildAttendancePdf({
        type: "payroll",
        title: `Month-end payroll - ${month}`,
        subtitle: `${report.from} to ${report.to}  |  ${report.workingDays} working days  |  penalty = salary / working days  |  fine = penalty x absent days`,
        header,
        rows,
      });
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    }

    const csv = [header, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
