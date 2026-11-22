import { strFromU8, unzipSync } from "fflate";
import { parseCsvTable, rowsFromCanonical, type MarkRow } from "./check";

export type IngestShape = "canonical-csv" | "shifted-csv" | "sheet3" | "flat";

export type IngestResult =
  | {
      ok: true;
      shape: IngestShape;
      rows: MarkRow[];
      notes: string[];
      refusedHeaders: string[];
      headerRow: number | null;
      sheetName: string | null;
    }
  | { ok: false; error: string; notes: string[] };

const AADHAAR = /(?<!\d)\d{12}(?!\d)/;
const PHONE = /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/;

const ROW_KEYS = [
  "student_id",
  "className",
  "session",
  "subject",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "fa_total",
  "co_curricular",
  "summative",
  "subject_total",
  "grand_total",
  "grade",
  "remark",
  "source",
  "u1",
  "u2",
  "t1",
  "t2",
] as const satisfies readonly (keyof MarkRow)[];

export function secretInValue(value: string): boolean {
  return AADHAAR.test(value) || PHONE.test(value);
}

export function scrubSecrets(rows: MarkRow[]): { rows: MarkRow[]; scrubbed: boolean } {
  let scrubbed = false;
  const next = rows.map((row) => {
    const copy = { ...row };
    for (const key of ROW_KEYS) {
      if (secretInValue(copy[key])) {
        copy[key] = "";
        scrubbed = true;
      }
    }
    return copy;
  });
  return { rows: next, scrubbed };
}

function blankRow(): MarkRow {
  return {
    student_id: "",
    className: "",
    session: "",
    subject: "",
    f1: "",
    f2: "",
    f3: "",
    f4: "",
    f5: "",
    f6: "",
    fa_total: "",
    co_curricular: "",
    summative: "",
    subject_total: "",
    grand_total: "",
    grade: "",
    remark: "",
    source: "",
    u1: "",
    u2: "",
    t1: "",
    t2: "",
  };
}

function normHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[._/\-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isStudentNameHeader(header: string): boolean {
  const text = normHeader(header);
  return text === "name" || text === "student name" || text === "name of student";
}

export function isRefusedHeader(header: string): boolean {
  const text = normHeader(header);
  if (!text) return false;
  if (/aadhaar|aadhar|uidai/.test(text)) return true;
  if (/phone|mobile|whatsapp|contact no/.test(text)) return true;
  if (/father|mother|parent|guardian/.test(text)) return true;
  if (/\baddress\b/.test(text)) return true;
  if (/date of birth|\bdob\b|d o b/.test(text)) return true;
  if (text === "category") return true;
  if (isStudentNameHeader(header)) return true;
  if (/admission/.test(text)) return true;
  if (/registration/.test(text)) return true;
  if (/\broll\b/.test(text)) return true;
  return false;
}

function storedNumber(raw: string): string {
  const text = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  const number = Number(text);
  return Number.isInteger(number) ? String(number) : String(number);
}

type CellGrid = {
  name: string;
  rows: string[][];
  merges: string[];
};

function tableToGrid(table: string[][], name: string): CellGrid {
  const rows: string[][] = [[]];
  for (const line of table) rows.push(line);
  return { name, rows, merges: [] };
}

function f1RowOf(grid: CellGrid): number {
  const limit = Math.min(grid.rows.length - 1, 15);
  for (let row = 1; row <= limit; row += 1) {
    const cells = (grid.rows[row] ?? []).map((cell) => cell.trim().toUpperCase());
    const f1 = cells.filter((cell) => cell === "F1").length;
    if (f1 >= 2 && cells.includes("F2") && cells.includes("F6")) return row;
  }
  return -1;
}

function titleText(grid: CellGrid): string {
  return grid.rows.slice(1, 3).flat().join(" ");
}

export function ingestCsv(text: string): IngestResult {
  const source = text.replace(/^\uFEFF/, "");
  if (source.trim() === "") return { ok: false, error: "The file is empty.", notes: [] };

  const canonical = rowsFromCanonical(source);
  if (canonical.ok) {
    return {
      ok: true,
      shape: "canonical-csv",
      rows: canonical.rows,
      notes: [
        canonical.componentColumns.length
          ? `Header is on row 1. Kept ${canonical.componentColumns.join(", ")}.`
          : "Header is on row 1 and matches data.csv.",
      ],
      refusedHeaders: [],
      headerRow: 1,
      sheetName: null,
    };
  }
  if (canonical.error === "The file is empty.") return { ok: false, error: canonical.error, notes: [] };

  const grid = tableToGrid(parseCsvTable(source, true), "csv");
  if (f1RowOf(grid) > 0) return fromSheet3(grid);
  return fromFlat(grid);
}

function headerAlias(header: string): keyof MarkRow | null {
  const text = normHeader(header);
  const aliases: Record<string, keyof MarkRow> = {
    "student id": "student_id",
    class: "className",
    session: "session",
    subject: "subject",
    f1: "f1",
    f2: "f2",
    f3: "f3",
    f4: "f4",
    f5: "f5",
    f6: "f6",
    "fa total": "fa_total",
    "formative total": "fa_total",
    formative: "fa_total",
    "co curricular": "co_curricular",
    activities: "co_curricular",
    summative: "summative",
    sa: "summative",
    "subject total": "subject_total",
    total: "subject_total",
    "grand total": "grand_total",
    grade: "grade",
    remark: "remark",
    remarks: "remark",
    source: "source",
    u1: "u1",
    u2: "u2",
    t1: "t1",
    t2: "t2",
  };
  return aliases[text] ?? null;
}

function fromFlat(grid: CellGrid): IngestResult {
  let headerRow = -1;
  for (let row = 1; row < grid.rows.length; row += 1) {
    const cells = (grid.rows[row] ?? []).map(normHeader);
    const hasSubject = cells.includes("subject");
    const hasMark = cells.includes("f1") || cells.includes("summative") || cells.includes("student id") || cells.includes("u1");
    if (hasSubject && hasMark) {
      headerRow = row;
      break;
    }
  }
  if (headerRow < 0) {
    return { ok: false, error: "No header row with a subject and a mark column was found.", notes: [] };
  }

  const notes: string[] = [];
  const header = grid.rows[headerRow] ?? [];
  if (headerRow !== 1) notes.push(`Header is on row ${headerRow}, not row 1.`);
  const refusedHeaders: string[] = [];
  const columns = new Map<keyof MarkRow, number>();
  header.forEach((cell, index) => {
    if (isRefusedHeader(cell)) {
      refusedHeaders.push(cell.trim());
      return;
    }
    const key = headerAlias(cell);
    if (key && !columns.has(key)) columns.set(key, index);
  });
  if (refusedHeaders.length) {
    notes.push(`These columns were not stored: ${refusedHeaders.join(", ")}`);
  }
  if (!columns.has("subject")) {
    return { ok: false, error: "The header has no subject column.", notes };
  }

  const inferred = inferSubjectGroups(grid, headerRow);
  notes.push(...inferred);

  const rows: MarkRow[] = [];
  let madeId = 0;
  for (let rowIndex = headerRow + 1; rowIndex < grid.rows.length; rowIndex += 1) {
    const line = grid.rows[rowIndex] ?? [];
    if (line.every((cell) => cell.trim() === "")) continue;
    const row = blankRow();
    for (const [key, index] of columns) row[key] = storedNumber(line[index] ?? "");
    if (!row.subject && !row.student_id && !row.f1 && !row.summative && !row.u1) continue;
    if (!columns.has("student_id")) {
      madeId += 1;
      row.student_id = `Student_${String(madeId).padStart(2, "0")}`;
    }
    if (!row.source) row.source = `${grid.name}:${rowIndex}`;
    rows.push(row);
  }
  if (madeId > 0) notes.push("No student id column was kept. Rows are labeled Student_01 in file order. Names were not stored.");
  if (rows.length === 0) return { ok: false, error: "The header was found, but there were no mark rows under it.", notes };

  const shape: IngestShape = headerRow === 1 ? "flat" : "shifted-csv";
  return {
    ok: true,
    shape,
    rows,
    notes,
    refusedHeaders,
    headerRow,
    sheetName: grid.name === "csv" ? null : grid.name,
  };
}

function inferSubjectGroups(grid: CellGrid, headerRow: number): string[] {
  if (headerRow < 2) return [];
  const above = grid.rows[headerRow - 1] ?? [];
  const notes: string[] = [];
  for (let index = 0; index < above.length; index += 1) {
    const name = above[index]?.trim() ?? "";
    if (!name) continue;
    let end = index;
    while (end + 1 < above.length && (above[end + 1] ?? "").trim() === "") end += 1;
    if (end > index) notes.push(`${name} covers columns ${index + 1}–${end + 1} on the row above the header.`);
    index = end;
  }
  return notes;
}

function classAndSession(grid: CellGrid, f1Row: number): { className: string; session: string } {
  const title = grid.rows.slice(1, Math.min(f1Row, 3)).flat().join(" ");
  const session = /session\s+(\d{4}-\d{2})/i.exec(title)?.[1] ?? (/(\d{4}-\d{2})/.exec(title)?.[1] ?? "");
  const className = /class\s+(\d+)/i.exec(title)?.[1] ?? "";
  return { className, session };
}

function findLabel(grid: CellGrid, f1Row: number, pattern: RegExp): number {
  for (let row = 1; row <= f1Row; row += 1) {
    const cells = grid.rows[row] ?? [];
    for (let col = 0; col < cells.length; col += 1) {
      if (pattern.test(normHeader(cells[col] ?? ""))) return col;
    }
  }
  return -1;
}

function colLetter(index: number): string {
  let n = index + 1;
  let text = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    text = String.fromCharCode(65 + rem) + text;
    n = Math.floor((n - 1) / 26);
  }
  return text;
}

function parseRange(ref: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!match) return null;
  return {
    c1: colNumber(match[1]),
    r1: Number(match[2]),
    c2: colNumber(match[3]),
    r2: Number(match[4]),
  };
}

function covers(ref: string, excelRow: number, col: number): boolean {
  const range = parseRange(ref);
  if (!range) return false;
  return excelRow >= range.r1 && excelRow <= range.r2 && col >= range.c1 && col <= range.c2;
}

type Block = {
  subject: string;
  cols: number[];
  fa: number;
  activities: number;
  summative: number;
  total: number;
};

function subjectBlocks(grid: CellGrid, f1Row: number, notes: string[]): Block[] {
  const fRow = grid.rows[f1Row] ?? [];
  const headerRow = grid.rows[f1Row - 1] ?? [];
  const subjectRow = grid.rows[f1Row - 2] ?? [];
  const starts: number[] = [];
  fRow.forEach((cell, index) => {
    if (cell.trim().toUpperCase() === "F1") starts.push(index);
  });

  return starts.map((start) => {
    const find = (pattern: RegExp, fallback: number): number => {
      for (let col = start + 6; col <= start + 16; col += 1) {
        const top = normHeader(headerRow[col] ?? "");
        const mid = normHeader(fRow[col] ?? "");
        if (pattern.test(top) || pattern.test(mid)) return col;
      }
      return fallback;
    };
    const fa = /total/.test(normHeader(fRow[start + 6] ?? "")) ? start + 6 : find(/^total$/, start + 6);
    const activities = /co curricular|activities/.test(normHeader(headerRow[start + 7] ?? ""))
      ? start + 7
      : find(/co curricular|activities/, start + 7);
    const summative = /summative/.test(normHeader(headerRow[start + 8] ?? ""))
      ? start + 8
      : find(/summative/, start + 8);
    const total = /total/.test(normHeader(headerRow[start + 9] ?? "")) ? start + 9 : find(/total/, start + 9);

    let subject = (subjectRow[start] ?? "").trim();
    if (!subject) {
      for (let row = f1Row - 2; row >= 1; row -= 1) {
        const value = (grid.rows[row]?.[start] ?? "").trim();
        if (value && !/formative|max marks|district|result register/i.test(value)) {
          subject = value;
          break;
        }
      }
    }
    const merge = grid.merges.find((ref) => covers(ref, f1Row - 2, start));
    if (merge && subject) notes.push(`${subject} is a merged group ${merge}.`);
    else if (subject) {
      let end = start;
      const width = subjectRow.length === 0 ? start + 12 : subjectRow.length;
      while (end + 1 < width && (subjectRow[end + 1] ?? "").trim() === "" && end - start < 14) end += 1;
      if (end > start) {
        notes.push(
          `${subject} covers ${colLetter(start)}–${colLetter(end)} on the subject row (empty cells beside the name).`,
        );
      }
    }
    return {
      subject,
      cols: [0, 1, 2, 3, 4, 5].map((offset) => start + offset),
      fa,
      activities,
      summative,
      total,
    };
  });
}

function fromSheet3(grid: CellGrid): IngestResult {
  const f1Row = f1RowOf(grid);
  if (f1Row < 0) return { ok: false, error: "No F1 header row was found.", notes: [] };

  const notes: string[] = [];
  const refusedCols = new Set<number>();
  const refusedHeaders: string[] = [];
  let nameCol = -1;
  for (let row = 1; row <= f1Row; row += 1) {
    (grid.rows[row] ?? []).forEach((cell, col) => {
      if (!cell.trim() || !isRefusedHeader(cell) || refusedCols.has(col)) return;
      refusedCols.add(col);
      refusedHeaders.push(cell.trim());
      if (isStudentNameHeader(cell)) nameCol = col;
    });
  }
  if (refusedHeaders.length) notes.push(`These columns were not stored: ${refusedHeaders.join(", ")}`);
  if (f1Row === 5) {
    notes.push("Sheet3-style header: rows 1–5 are titles, and student marks start on row 6.");
  } else if (f1Row !== 1) {
    notes.push(`Header is not on row 1. F1 labels are on row ${f1Row}, and marks start on row ${f1Row + 1}.`);
  }

  const blocks = subjectBlocks(grid, f1Row, notes).filter((block) => block.subject);
  if (blocks.length === 0) return { ok: false, error: "Subject groups were not found under the F1 labels.", notes };

  const { className, session } = classAndSession(grid, f1Row);
  if (!className || !session) notes.push("Class or session was not in the title rows, so that cell is blank.");
  const grandCol = findLabel(grid, f1Row, /^grand total/);
  const gradeCol = findLabel(grid, f1Row, /^grade$/);
  const remarkCol = findLabel(grid, f1Row, /^remarks?$/);

  const seen = new Map<string, string>();
  let repeated = 0;
  let conflicting = 0;
  const rows: MarkRow[] = [];
  let studentCount = 0;

  for (let excelRow = f1Row + 1; excelRow < grid.rows.length; excelRow += 1) {
    const line = grid.rows[excelRow] ?? [];
    const name = nameCol >= 0 ? (line[nameCol] ?? "").trim() : "";
    const firstMark = (line[blocks[0].cols[0]] ?? "").trim();
    if (nameCol >= 0 ? name === "" : firstMark === "") continue;
    studentCount += 1;
    const studentId = `Student_${String(studentCount).padStart(2, "0")}`;
    const fingerprint = blocks
      .map((block) => [block.subject, ...block.cols.map((col) => line[col] ?? ""), line[block.total] ?? ""].join("|"))
      .join("||");
    if (name) {
      const key = name.toLowerCase().replace(/\s+/g, " ");
      const prev = seen.get(key);
      if (prev !== undefined) {
        repeated += 1;
        if (prev !== fingerprint) conflicting += 1;
      } else {
        seen.set(key, fingerprint);
      }
    }
    const sourceSheet = grid.name.toLowerCase() === "sheet3" ? "sheet3" : grid.name;
    for (const block of blocks) {
      const row = blankRow();
      row.student_id = studentId;
      row.className = className;
      row.session = session;
      row.subject = block.subject;
      row.f1 = storedNumber(line[block.cols[0]] ?? "");
      row.f2 = storedNumber(line[block.cols[1]] ?? "");
      row.f3 = storedNumber(line[block.cols[2]] ?? "");
      row.f4 = storedNumber(line[block.cols[3]] ?? "");
      row.f5 = storedNumber(line[block.cols[4]] ?? "");
      row.f6 = storedNumber(line[block.cols[5]] ?? "");
      row.fa_total = storedNumber(line[block.fa] ?? "");
      row.co_curricular = storedNumber(line[block.activities] ?? "");
      row.summative = storedNumber(line[block.summative] ?? "");
      row.subject_total = storedNumber(line[block.total] ?? "");
      row.grand_total = grandCol >= 0 ? storedNumber(line[grandCol] ?? "") : "";
      row.grade = gradeCol >= 0 ? (line[gradeCol] ?? "").trim() : "";
      row.remark = remarkCol >= 0 ? (line[remarkCol] ?? "").trim() : "";
      row.source = `${sourceSheet}:${excelRow}`;
      rows.push(row);
    }
  }
  seen.clear();
  if (repeated > 0) {
    notes.push(
      `${repeated} extra row${repeated === 1 ? "" : "s"} used a name already on the sheet. They were not merged. Names were not stored.`,
    );
  }
  if (conflicting > 0) {
    notes.push(`${conflicting} of those repeated names had different marks. Neither row was dropped.`);
  }
  if (rows.length === 0) return { ok: false, error: "No student rows were found under the header.", notes };

  return {
    ok: true,
    shape: "sheet3",
    rows,
    notes,
    refusedHeaders,
    headerRow: f1Row,
    sheetName: grid.name,
  };
}

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCharCode(Number(value)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, value: string) => String.fromCharCode(parseInt(value, 16)));
}

function attr(tag: string, name: string): string {
  const match = new RegExp(`(?:^|\\s)${name.replace(":", "\\:")}="([^"]*)"`, "i").exec(tag);
  return match?.[1] ?? "";
}

function colNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    if (ch < "A" || ch > "Z") break;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function rowNumber(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    if (ch >= "0" && ch <= "9") n = n * 10 + (ch.charCodeAt(0) - 48);
  }
  return n;
}

function zipGet(files: Record<string, Uint8Array>, path: string): Uint8Array | null {
  if (files[path]) return files[path];
  const found = Object.keys(files).find((key) => key.replace(/\\/g, "/").toLowerCase() === path.toLowerCase());
  return found ? files[found] : null;
}

function loadSharedStrings(files: Record<string, Uint8Array>): string[] {
  const bytes = zipGet(files, "xl/sharedStrings.xml");
  if (!bytes) return [];
  const xml = strFromU8(bytes);
  const strings: string[] = [];
  const pattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const parts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]));
    strings.push(parts.join(""));
  }
  return strings;
}

function listSheets(files: Record<string, Uint8Array>): { name: string; path: string }[] {
  const bookBytes = zipGet(files, "xl/workbook.xml");
  const relBytes = zipGet(files, "xl/_rels/workbook.xml.rels");
  if (!bookBytes || !relBytes) return [];
  const rels = strFromU8(relBytes);
  const targets = new Map<string, string>();
  for (const tag of rels.match(/<Relationship\b[^>]*\/?>/g) ?? []) {
    const id = attr(tag, "Id");
    const target = attr(tag, "Target").replace(/\\/g, "/").replace(/^\//, "");
    if (!id || !target) continue;
    targets.set(id, target.startsWith("xl/") ? target : `xl/${target}`);
  }
  const sheets: { name: string; path: string }[] = [];
  for (const tag of strFromU8(bookBytes).match(/<sheet\b[^>]*\/?>/g) ?? []) {
    const name = attr(tag, "name");
    const id = attr(tag, "r:id") || attr(tag, "id");
    const path = targets.get(id);
    if (name && path) sheets.push({ name, path });
  }
  return sheets;
}

function cellValue(type: string, raw: string, strings: string[]): string {
  if (type === "s") {
    const index = Number(raw);
    return Number.isInteger(index) ? (strings[index] ?? "") : "";
  }
  if (type === "inlineStr" || type === "str") return raw;
  if (type === "e") return "";
  return raw;
}

function scanCells(
  xml: string,
  strings: string[],
  onCell: (row: number, col: number, read: () => string) => boolean,
): void {
  let index = 0;
  while (index < xml.length) {
    const start = xml.indexOf("<c", index);
    if (start < 0) break;
    const next = xml[start + 2];
    if (next !== " " && next !== ">" && next !== "/") {
      index = start + 2;
      continue;
    }
    const gt = xml.indexOf(">", start);
    if (gt < 0) break;
    const head = xml.slice(start, gt + 1);
    if (head.endsWith("/>")) {
      index = gt + 1;
      continue;
    }
    const end = xml.indexOf("</c>", gt);
    if (end < 0) break;
    const ref = attr(head, "r");
    const type = attr(head, "t");
    const inner = xml.slice(gt + 1, end);
    let raw = "";
    if (type === "inlineStr") {
      raw = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join("");
    } else {
      const value = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner);
      raw = value ? decodeXml(value[1]) : "";
    }
    if (ref) {
      const row = rowNumber(ref);
      const col = colNumber(ref.replace(/\d+/g, ""));
      const keepGoing = onCell(row, col, () => cellValue(type, raw.trim(), strings));
      if (!keepGoing) return;
    }
    index = end + 4;
  }
}

function putCell(rows: string[][], row: number, col: number, value: string): void {
  while (rows.length <= row) rows.push([]);
  const line = rows[row];
  while (line.length <= col) line.push("");
  line[col] = value;
}

function previewGrid(xml: string, strings: string[], name: string): CellGrid {
  const rows: string[][] = [[]];
  scanCells(xml, strings, (row, col, read) => {
    if (row > 5) return false;
    putCell(rows, row, col, read());
    return true;
  });
  return { name, rows, merges: [] };
}

function readMerges(xml: string): string[] {
  return [...xml.matchAll(/<mergeCell\b[^>]*ref="([^"]+)"/g)].map((match) => match[1]);
}

function dataGrid(xml: string, strings: string[], name: string, refusedCols: Set<number>, nameCol: number): CellGrid {
  const rows: string[][] = [[]];
  const merges = readMerges(xml);
  scanCells(xml, strings, (row, col, read) => {
    if (row > 5 && refusedCols.has(col) && col !== nameCol) return true;
    putCell(rows, row, col, read());
    return true;
  });
  return { name, rows, merges };
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function ingestXlsx(buffer: ArrayBuffer): IngestResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    return { ok: false, error: "That file is not an .xlsx workbook this page can read.", notes: [] };
  }

  const strings = loadSharedStrings(files);
  const sheets = listSheets(files);
  if (sheets.length === 0) return { ok: false, error: "The workbook has no sheets.", notes: [] };

  const previews = sheets.map((sheet) => {
    const bytes = zipGet(files, sheet.path);
    const xml = bytes ? strFromU8(bytes) : "";
    const grid = previewGrid(xml, strings, sheet.name);
    return {
      sheet,
      grid,
      shaped: f1RowOf(grid) > 0,
      yug: /yug/i.test(titleText(grid)),
    };
  });

  const yug = previews.filter((item) => item.yug && item.shaped);
  const shaped = previews.filter((item) => item.shaped);
  const chosen = yug.length > 0 ? yug : shaped.slice(0, 1);

  if (chosen.length === 0) {
    const first = sheets[0];
    const bytes = zipGet(files, first.path);
    const xml = bytes ? strFromU8(bytes) : "";
    const grid = dataGrid(xml, strings, first.name, new Set(), -1);
    strings.length = 0;
    return fromFlat(grid);
  }

  const notes: string[] = [];
  const skipped = previews.filter((item) => !chosen.includes(item)).map((item) => item.sheet.name);
  if (skipped.length > 0 && yug.length > 0) {
    notes.push(
      `${joinNames(skipped)} ${skipped.length === 1 ? "was" : "were"} not stored. Only the Yug sheet is kept from this workbook. Aadhaar, phone, parent names, address, and date of birth are not written into the database.`,
    );
  }

  const rows: MarkRow[] = [];
  const refusedHeaders: string[] = [];
  let headerRow: number | null = null;
  let sheetName = "";
  for (const item of chosen) {
    const f1Row = f1RowOf(item.grid);
    const refusedCols = new Set<number>();
    let nameCol = -1;
    for (let row = 1; row <= f1Row; row += 1) {
      (item.grid.rows[row] ?? []).forEach((cell, col) => {
        if (!isRefusedHeader(cell)) return;
        refusedCols.add(col);
        if (isStudentNameHeader(cell)) nameCol = col;
      });
    }
    const bytes = zipGet(files, item.sheet.path);
    const xml = bytes ? strFromU8(bytes) : "";
    const grid = dataGrid(xml, strings, item.sheet.name, refusedCols, nameCol);
    const extracted = fromSheet3(grid);
    if (!extracted.ok) {
      strings.length = 0;
      return extracted;
    }
    if (rows.length > 0) {
      const offset = rows.reduce((max, row) => Math.max(max, Number(row.student_id.replace(/\D/g, "")) || 0), 0);
      for (const row of extracted.rows) {
        const current = Number(row.student_id.replace(/\D/g, "")) || 0;
        row.student_id = `Student_${String(offset + current).padStart(2, "0")}`;
      }
    }
    rows.push(...extracted.rows);
    notes.push(...extracted.notes);
    refusedHeaders.push(...extracted.refusedHeaders);
    headerRow = extracted.headerRow;
    sheetName = sheetName ? `${sheetName}, ${item.sheet.name}` : item.sheet.name;
  }
  strings.length = 0;
  if (rows.length === 0) return { ok: false, error: "No student rows were found.", notes };
  return {
    ok: true,
    shape: "sheet3",
    rows,
    notes,
    refusedHeaders: [...new Set(refusedHeaders)],
    headerRow,
    sheetName,
  };
}
