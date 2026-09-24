import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const NAVY = rgb(6 / 255, 35 / 255, 45 / 255);
const TEAL = rgb(14 / 255, 138 / 255, 150 / 255);
const INK = rgb(18 / 255, 32 / 255, 42 / 255);
const MUTED = rgb(93 / 255, 109 / 255, 117 / 255);
const LINE = rgb(215 / 255, 225 / 255, 227 / 255);
const PAPER = rgb(243 / 255, 246 / 255, 244 / 255);
const WHITE = rgb(1, 1, 1);
const PRESENT = rgb(6 / 255, 120 / 255, 80 / 255);
const ABSENT = rgb(190 / 255, 28 / 255, 36 / 255);
const LEAVE = rgb(160 / 255, 120 / 255, 40 / 255);

export function pdfSafe(value: unknown): string {
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

function fit(font: PDFFont, text: string, size: number, maxWidth: number) {
  const safe = pdfSafe(text);
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let cut = safe;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}

function markColor(value: string) {
  if (["P", "L", "E", "HD"].includes(value)) return PRESENT;
  if (value === "A") return ABSENT;
  if (value === "V") return LEAVE;
  return INK;
}

function columnWidths(headers: string[], inner: number, presence: boolean) {
  if (presence) {
    const countNames = new Set(["Present", "Late", "Absent", "Leave"]);
    const nameW = 96;
    const codeW = 42;
    const deptW = 58;
    const countW = 30;
    const countCount = headers.filter((h) => countNames.has(h)).length;
    const dayCount = Math.max(1, headers.length - 3 - countCount);
    const leftover = inner - nameW - codeW - deptW - countCount * countW;
    const dayW = Math.max(13, leftover / dayCount);
    return headers.map((header, index) => {
      if (index === 0) return nameW;
      if (index === 1) return codeW;
      if (index === 2) return deptW;
      if (countNames.has(header)) return countW;
      return dayW;
    });
  }

  const weights = headers.map((header) => {
    const key = header.toLowerCase();
    if (key === "name" || key === "employee") return 3;
    if (key === "department" || key === "dept" || key === "punches") return 2.4;
    if (key === "date" || key === "time" || key === "reason") return 2.2;
    if (key === "status") return 1.6;
    return 1.2;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => (w / total) * inner);
}

function reportTitle(type: string) {
  const labels: Record<string, string> = {
    presence: "Daily presence register",
    daily: "Daily attendance",
    weekly: "Weekly summary",
    monthly: "Monthly summary",
    employee: "Employee-wise attendance",
    department: "Department-wise attendance",
    late: "Late arrivals",
    absent: "Absences",
    hours: "Working hours",
    leave: "Leave register",
    raw: "Raw punch log",
  };
  return labels[type] ?? `${type} report`;
}

export async function buildAttendancePdf(input: {
  type: string;
  title?: string;
  subtitle?: string;
  header: string[];
  rows: string[][];
}) {
  const presence = input.type === "presence";
  const landscape = presence || input.header.length > 7;
  const pageW = landscape ? 842 : 595;
  const pageH = landscape ? 595 : 842;
  const margin = 28;
  const inner = pageW - margin * 2;
  const widths = columnWidths(input.header, inner, presence);
  const rowH = presence ? 14 : 16;
  const fontSize = presence ? 6.5 : 8;
  const headerH = 16;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page!: PDFPage;
  let y = 0;
  let pageNo = 0;

  const footer = (current: PDFPage) => {
    current.drawText(pdfSafe(`Page ${pageNo}`), {
      x: pageW - margin - 40,
      y: 14,
      size: 8,
      font,
      color: MUTED,
    });
    current.drawText(pdfSafe("7 Air Travels ATFS"), {
      x: margin,
      y: 14,
      size: 8,
      font,
      color: MUTED,
    });
  };

  const newPage = () => {
    if (pageNo > 0) footer(page);
    page = doc.addPage([pageW, pageH]);
    pageNo += 1;
    page.drawRectangle({ x: 0, y: pageH - 36, width: pageW, height: 36, color: NAVY });
    page.drawText(pdfSafe("7 Air Travels"), { x: margin, y: pageH - 16, size: 13, font: bold, color: WHITE });
    page.drawText(pdfSafe("Attendance & Fingerprint Tracking System"), {
      x: margin,
      y: pageH - 28,
      size: 8,
      font,
      color: rgb(0.75, 0.86, 0.88),
    });
    y = pageH - 52;
    if (pageNo === 1) {
      page.drawText(pdfSafe(input.title ?? reportTitle(input.type)), {
        x: margin,
        y,
        size: 13,
        font: bold,
        color: INK,
      });
      y -= 14;
      if (input.subtitle) {
        page.drawText(fit(font, input.subtitle, 8, inner), {
          x: margin,
          y,
          size: 8,
          font,
          color: MUTED,
        });
        y -= 16;
      } else {
        y -= 6;
      }
    }
    drawHeaderRow();
  };

  const drawHeaderRow = () => {
    let x = margin;
    page.drawRectangle({ x: margin, y: y - 4, width: inner, height: headerH, color: TEAL });
    input.header.forEach((label, index) => {
      const w = widths[index] ?? 20;
      page.drawText(fit(bold, label, fontSize, w - 4), {
        x: x + 2,
        y: y + 2,
        size: fontSize,
        font: bold,
        color: WHITE,
      });
      x += w;
    });
    y -= headerH + 2;
  };

  const drawRow = (cells: string[], index: number) => {
    if (y < 36) newPage();
    let x = margin;
    if (index % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - 3, width: inner, height: rowH, color: PAPER });
    }
    cells.forEach((cell, col) => {
      const w = widths[col] ?? 20;
      const value = pdfSafe(cell);
      const color = presence && col >= 3 ? markColor(value) : INK;
      const used = presence && col >= 3 && value.length <= 2 ? bold : font;
      page.drawText(fit(used, value, fontSize, w - 4), {
        x: x + 2,
        y: y + 1,
        size: fontSize,
        font: used,
        color,
      });
      x += w;
    });
    page.drawLine({
      start: { x: margin, y: y - 3 },
      end: { x: margin + inner, y: y - 3 },
      thickness: 0.3,
      color: LINE,
    });
    y -= rowH;
  };

  newPage();
  input.rows.forEach((row, index) => drawRow(row, index));

  if (presence && y < 48) newPage();
  if (presence) {
    page.drawText(
      pdfSafe("P Present   L Late   A Absent   V Leave   H Holiday   W Weekend   HD Half-day   E Early   - No record"),
      { x: margin, y: Math.max(28, y - 8), size: 7, font, color: MUTED },
    );
  }
  footer(page);

  return Buffer.from(await doc.save());
}
