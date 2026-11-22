import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { MarkParts, Report, StudentResult, SubjectCell } from "./check";
import { printDateLine } from "./dates";

type ReadyReport = Extract<Report, { ok: true }>;

const ink = rgb(0.1, 0.08, 0.06);

export type PaperSize = "A4" | "A5" | "Letter";

export type CardLayout = {
  showFather: boolean;
  showFormativeColumns: boolean;
  showUnusedNote: boolean;
  paper: PaperSize;
  marginMm: number;
  scale: number;
  rowHeight: number;
};

/** School card: A4, father's line, F1–F6, and the unused-subject note. */
export const SCHOOL_LAYOUT: CardLayout = {
  showFather: true,
  showFormativeColumns: true,
  showUnusedNote: true,
  paper: "A4",
  marginMm: 12,
  scale: 1,
  rowHeight: 28,
};

export const PAPER_PT: Record<PaperSize, [number, number]> = {
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
};

export const PAPER_RATIO: Record<PaperSize, string> = {
  A4: "210 / 297",
  A5: "148 / 210",
  Letter: "8.5 / 11",
};

export function clampLayout(layout: CardLayout): CardLayout {
  const paper = layout.paper === "A5" || layout.paper === "Letter" ? layout.paper : "A4";
  return {
    showFather: layout.showFather,
    showFormativeColumns: layout.showFormativeColumns,
    showUnusedNote: layout.showUnusedNote,
    paper,
    marginMm: clampNum(layout.marginMm, 8, 36),
    scale: clampNum(layout.scale, 0.75, 1.4),
    rowHeight: clampNum(layout.rowHeight, 16, 48),
  };
}

function clampNum(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export type CardOptions = {
  fathers: Readonly<Record<string, string>>;
  layout: CardLayout;
  generatedAt: Date;
  presetIsRegister: boolean;
};

type Column = {
  header: [string, string];
  width: number;
  name: boolean;
  text: (subject: SubjectCell) => string;
  grand: string;
};

function fmt(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "";
  return Number.isInteger(value) ? String(value) : String(value);
}

function sumParts(subjects: StudentResult["subjects"], key: keyof MarkParts): number | null {
  const values = subjects.map((subject) => subject.marks[key]);
  if (values.some((value) => value === null)) return null;
  return (values as number[]).reduce((total, value) => total + value, 0);
}

function columnsFor(student: StudentResult, showFormative: boolean): Column[] {
  const columns: Column[] = [
    {
      header: ["Subject", ""],
      width: showFormative ? 112 : 180,
      name: true,
      text: (subject) => subject.cardName.toUpperCase(),
      grand: "GRAND TOTAL",
    },
  ];
  if (showFormative) {
    const keys = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;
    keys.forEach((key, index) => {
      columns.push({
        header: [`F${index + 1}`, "(5)"],
        width: 34,
        name: false,
        text: (subject) => fmt(subject.marks[key]),
        grand: fmt(sumParts(student.subjects, key)),
      });
    });
  }
  columns.push(
    {
      header: ["Total", "(30)"],
      width: showFormative ? 46 : 70,
      name: false,
      text: (subject) => fmt(subject.marks.fa),
      grand: fmt(sumParts(student.subjects, "fa")),
    },
    {
      header: ["Activities", "(20)"],
      width: showFormative ? 62 : 90,
      name: false,
      text: (subject) => fmt(subject.marks.activities),
      grand: fmt(sumParts(student.subjects, "activities")),
    },
    {
      header: ["Summative", "(50)"],
      width: showFormative ? 58 : 96,
      name: false,
      text: (subject) => fmt(subject.marks.summative),
      grand: fmt(sumParts(student.subjects, "summative")),
    },
    {
      header: ["Total", "(100)"],
      width: showFormative ? 54 : 100,
      name: false,
      text: (subject) => fmt(subject.total),
      grand: fmt(student.grandTotal),
    },
  );
  return columns;
}

function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + (width - textWidth) / 2,
    y: y + (height - size) / 2,
    size,
    font,
    color: ink,
  });
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCard(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  student: StudentResult,
  report: ReadyReport,
  options: CardOptions,
): void {
  const { width, height } = page.getSize();
  const layout = clampLayout(options.layout);
  const scale = layout.scale;
  const margin = layout.marginMm * (72 / 25.4);
  const rowH = layout.rowHeight * scale;
  const headerH = 32 * scale;
  const rawColumns = columnsFor(student, layout.showFormativeColumns);
  const baseWidth = rawColumns.reduce((total, column) => total + column.width, 0);
  const inner = Math.max(140, width - margin * 2);
  const fit = Math.min(1, inner / (baseWidth * scale));
  const drawScale = scale * fit;
  const columns = rawColumns.map((column) => ({ ...column, width: column.width * drawScale }));
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);
  const left = margin + Math.max(0, (inner - tableWidth) / 2);

  const school = "GOVT. MIDDLE SCHOOL YUG (ZONE JIB)";
  const schoolSize = 13 * scale;
  const schoolWidth = bold.widthOfTextAtSize(school, schoolSize);
  const schoolX = (width - schoolWidth) / 2;
  const schoolY = height - margin - 24 * scale;
  page.drawText(school, { x: schoolX, y: schoolY, size: schoolSize, font: bold, color: ink });
  page.drawLine({
    start: { x: schoolX, y: schoolY - 3 },
    end: { x: schoolX + schoolWidth, y: schoolY - 3 },
    thickness: 0.8,
    color: ink,
  });

  const title = "REPORT CARD";
  const titleSize = 12 * scale;
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  const titleX = (width - titleWidth) / 2;
  const titleY = schoolY - 28 * scale;
  page.drawText(title, { x: titleX, y: titleY, size: titleSize, font: bold, color: ink });
  page.drawLine({
    start: { x: titleX, y: titleY - 3 },
    end: { x: titleX + titleWidth, y: titleY - 3 },
    thickness: 0.8,
    color: ink,
  });

  const labelSize = 10 * scale;
  const drawField = (label: string, value: string, x: number, y: number, line: number) => {
    page.drawText(label, { x, y, size: labelSize, font: regular, color: ink });
    const labelWidth = regular.widthOfTextAtSize(label, labelSize);
    const lineX = x + labelWidth + 6;
    page.drawLine({
      start: { x: lineX, y: y - 2 },
      end: { x: lineX + line, y: y - 2 },
      thickness: 0.6,
      color: ink,
    });
    if (value) {
      page.drawText(value, { x: lineX + 4, y, size: labelSize, font: bold, color: ink });
    }
  };

  const father = layout.showFather ? (options.fathers[student.studentId] ?? "") : "";
  const right = left + tableWidth / 2 + 8;
  drawField("NAME:", "", left, titleY - 36 * scale, 180 * scale);
  drawField("CLASS:", student.className || report.className, right, titleY - 36 * scale, 80 * scale);
  drawField("FATHER'S NAME:", father, left, titleY - 58 * scale, 150 * scale);
  drawField("ROLL NO.:", student.studentId, right, titleY - 58 * scale, 110 * scale);
  drawField("GRADE:", student.grade, left, titleY - 80 * scale, 80 * scale);
  drawField("YEAR:", report.session, right, titleY - 80 * scale, 90 * scale);

  const printLines = wrap(regular, printDateLine(options.generatedAt), 8 * scale, tableWidth);
  let cursor = titleY - 100 * scale;
  for (const line of printLines) {
    page.drawText(line, { x: left, y: cursor, size: 8, font: regular, color: ink });
    cursor -= 11 * scale;
  }

  const rows = student.subjects.length + 1;
  const tableTop = cursor - 8;
  const tableBottom = tableTop - headerH - rows * rowH;
  const xs: number[] = [left];
  for (const column of columns) xs.push(xs[xs.length - 1] + column.width);

  const hline = (y: number) => {
    page.drawLine({
      start: { x: left, y },
      end: { x: left + tableWidth, y },
      thickness: 0.8,
      color: ink,
    });
  };
  hline(tableTop);
  hline(tableTop - headerH);
  for (let i = 1; i <= rows; i += 1) hline(tableTop - headerH - i * rowH);
  for (const x of xs) {
    page.drawLine({
      start: { x, y: tableTop },
      end: { x, y: tableBottom },
      thickness: 0.8,
      color: ink,
    });
  }

  columns.forEach((column, index) => {
    const x = xs[index];
    if (column.name) {
      drawCentered(page, column.header[0], bold, 8, x, tableTop - headerH, column.width, headerH);
      return;
    }
    page.drawText(column.header[0], {
      x: x + (column.width - bold.widthOfTextAtSize(column.header[0], 7)) / 2,
      y: tableTop - 14,
      size: 7,
      font: bold,
      color: ink,
    });
    page.drawText(column.header[1], {
      x: x + (column.width - regular.widthOfTextAtSize(column.header[1], 7)) / 2,
      y: tableTop - 24,
      size: 7,
      font: regular,
      color: ink,
    });
  });

  student.subjects.forEach((subject, index) => {
    const y = tableTop - headerH - (index + 1) * rowH;
    columns.forEach((column, col) => {
      const value = column.text(subject);
      if (column.name) {
        page.drawText(value, { x: xs[col] + 4, y: y + 10, size: 7.5, font: regular, color: ink });
      } else {
        drawCentered(page, value, regular, 9, xs[col], y, column.width, rowH);
      }
    });
  });

  const grandY = tableBottom;
  columns.forEach((column, col) => {
    if (column.name) {
      page.drawText(column.grand, { x: xs[col] + 4, y: grandY + 10, size: 7, font: bold, color: ink });
    } else {
      drawCentered(page, column.grand, bold, 9, xs[col], grandY, column.width, rowH);
    }
  });

  cursor = tableBottom - 28;
  page.drawText("RESULT:", { x: left, y: cursor, size: 10, font: regular, color: ink });
  const resultLabel = regular.widthOfTextAtSize("RESULT:", 10);
  page.drawLine({
    start: { x: left + resultLabel + 6, y: cursor - 2 },
    end: { x: left + resultLabel + 220, y: cursor - 2 },
    thickness: 0.6,
    color: ink,
  });
  if (student.remark) {
    page.drawText(student.remark, {
      x: left + resultLabel + 10,
      y: cursor,
      size: 10,
      font: bold,
      color: ink,
    });
  }

  cursor -= 18;
  const unused = student.subjects.filter((subject) => subject.unused).map((subject) => subject.cardName);
  if (layout.showUnusedNote && unused.length) {
    const note = `${unused.join(", ")} is 0 for every student in this file, so a percentage is out of ${student.countedMax}, not 600.`;
    for (const line of wrap(regular, note, 8, tableWidth)) {
      page.drawText(line, { x: left, y: cursor, size: 8, font: regular, color: ink });
      cursor -= 11;
    }
  }
  if (!options.presetIsRegister) {
    const note = "The grade on this card is the grade written on the sheet. It was not recomputed.";
    for (const line of wrap(regular, note, 8, tableWidth)) {
      page.drawText(line, { x: left, y: cursor, size: 8, font: regular, color: ink });
      cursor -= 11;
    }
  }
  if (student.reasons.length) {
    const note = `Do not print this as final. ${student.reasons.join(" ")}`;
    for (const line of wrap(regular, note, 8, tableWidth).slice(0, 4)) {
      page.drawText(line, { x: left, y: cursor, size: 8, font: regular, color: ink });
      cursor -= 11;
    }
  }

  const signY = 72;
  page.drawText("INCHARGE", { x: left, y: signY, size: 10, font: bold, color: ink });
  const head = "HEADMASTER";
  page.drawText(head, {
    x: left + tableWidth - bold.widthOfTextAtSize(head, 10),
    y: signY,
    size: 10,
    font: bold,
    color: ink,
  });
}

export async function buildCards(report: ReadyReport, options: CardOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`MS Yug class ${report.className} report cards ${report.session}`);
  pdf.setAuthor("Govt. Middle School Yug");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const size = PAPER_PT[clampLayout(options.layout).paper];
  for (const student of report.students) {
    const page = pdf.addPage(size);
    drawCard(page, regular, bold, student, report, options);
  }
  return pdf.save();
}
