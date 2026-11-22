import { strFromU8, unzipSync } from "fflate";

export type ParsedExam = {
  className: string;
  subject: string;
  date: string;
  room: string;
};

export type ScheduleScan = {
  note: string;
  exams: ParsedExam[];
};

const NO_DATE =
  "The workbook in local/ has no exam-date column, so no school timetable was loaded.";

const DATE_HEADER = /^(exam date|test date|date of exam|date|schedule date|exam day)$/i;
const ROOM_HEADER = /^(room|room no\.?|room number|hall|hall no\.?)$/i;
const CALENDAR_HEADER = /^(calendar|timetable|time table)$/i;
const BIRTH = /d\.?\s*o\.?\s*b|birth/i;
const CLASS_HEADER = /^(class|class name)$/i;
const SUBJECT_HEADER = /^(subject|paper)$/i;

type HeaderKind = "date" | "room" | "calendar" | "class" | "subject";

function kindOf(label: string): HeaderKind | null {
  const text = label.replace(/\s+/g, " ").trim();
  if (!text || BIRTH.test(text)) return null;
  if (DATE_HEADER.test(text)) return "date";
  if (ROOM_HEADER.test(text)) return "room";
  if (CALENDAR_HEADER.test(text)) return "calendar";
  if (CLASS_HEADER.test(text)) return "class";
  if (SUBJECT_HEADER.test(text)) return "subject";
  return null;
}

function attr(tag: string, name: string): string {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : "";
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function colNumber(letters: string): number {
  let total = 0;
  for (const letter of letters) total = total * 26 + (letter.charCodeAt(0) - 64);
  return total;
}

function sharedStrings(files: Record<string, Uint8Array>): string[] {
  const bytes = files["xl/sharedStrings.xml"];
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

function sheetsOf(files: Record<string, Uint8Array>): { name: string; path: string }[] {
  const book = files["xl/workbook.xml"];
  const rels = files["xl/_rels/workbook.xml.rels"];
  if (!book || !rels) return [];
  const targets = new Map<string, string>();
  for (const tag of strFromU8(rels).match(/<Relationship\b[^>]*\/?>/g) ?? []) {
    const id = attr(tag, "Id");
    const target = attr(tag, "Target").replace(/\\/g, "/").replace(/^\//, "");
    if (id && target) targets.set(id, target.startsWith("xl/") ? target : `xl/${target}`);
  }
  const sheets: { name: string; path: string }[] = [];
  for (const tag of strFromU8(book).match(/<sheet\b[^>]*\/?>/g) ?? []) {
    const name = attr(tag, "name");
    const id = attr(tag, "r:id") || attr(tag, "id");
    const path = targets.get(id);
    if (name && path) sheets.push({ name, path });
  }
  return sheets;
}

function headerMap(xml: string, strings: string[]): Map<number, HeaderKind> {
  const found = new Map<number, HeaderKind>();
  const cell = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let match: RegExpExecArray | null;
  while ((match = cell.exec(xml))) {
    const head = match[1];
    const ref = attr(head, "r");
    const rowMatch = /\d+/.exec(ref);
    const row = rowMatch ? Number(rowMatch[0]) : 0;
    if (row > 8) break;
    if (row < 1) continue;
    const letters = ref.replace(/\d+/g, "");
    const col = colNumber(letters);
    const type = attr(head, "t");
    let raw = "";
    if (type === "inlineStr") {
      raw = [...(match[2] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join("");
    } else {
      const value = /<v[^>]*>([\s\S]*?)<\/v>/.exec(match[2] ?? "");
      raw = value ? decodeXml(value[1]) : "";
    }
    const text = type === "s" ? (strings[Number(raw)] ?? "") : raw;
    const kind = kindOf(text);
    if (kind && !found.has(col)) found.set(col, kind);
  }
  return found;
}

function cellText(type: string, raw: string, strings: string[]): string {
  if (type === "s") return strings[Number(raw)] ?? "";
  return raw;
}

function isoDate(value: string): string {
  const text = value.trim();
  const written = /^(\d{4})-(\d{2})-(\d{2})/.exec(text) ?? /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (written && written[0].includes("-") && written[1].length === 4) return `${written[1]}-${written[2]}-${written[3]}`;
  if (written && written[3]?.length === 4 && written[1].length <= 2) {
    return `${written[3]}-${written[2].padStart(2, "0")}-${written[1].padStart(2, "0")}`;
  }
  const serial = Number(text);
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return "";
  const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function examsFromSheet(xml: string, strings: string[], headers: Map<number, HeaderKind>): ParsedExam[] {
  const wanted = new Map<number, HeaderKind>();
  for (const [col, kind] of headers) {
    if (kind === "date" || kind === "class" || kind === "subject" || kind === "room") wanted.set(col, kind);
  }
  const rows = new Map<number, Partial<Record<HeaderKind, string>>>();
  const cell = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let match: RegExpExecArray | null;
  while ((match = cell.exec(xml))) {
    const head = match[1];
    const ref = attr(head, "r");
    const rowMatch = /\d+/.exec(ref);
    const row = rowMatch ? Number(rowMatch[0]) : 0;
    if (row < 9) continue;
    const col = colNumber(ref.replace(/\d+/g, ""));
    const kind = wanted.get(col);
    if (!kind) continue;
    const type = attr(head, "t");
    let raw = "";
    if (type === "inlineStr") {
      raw = [...(match[2] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join("");
    } else {
      const value = /<v[^>]*>([\s\S]*?)<\/v>/.exec(match[2] ?? "");
      raw = value ? decodeXml(value[1]) : "";
    }
    const text = cellText(type, raw, strings).replace(/\s+/g, " ").trim();
    if (!text || BIRTH.test(text)) continue;
    const line = rows.get(row) ?? {};
    line[kind] = kind === "date" ? isoDate(text) : text;
    rows.set(row, line);
  }
  const exams: ParsedExam[] = [];
  for (const line of rows.values()) {
    if (!line.date) continue;
    exams.push({
      className: line.class ?? "",
      subject: line.subject ?? "",
      date: line.date,
      room: line.room ?? "",
    });
  }
  return exams;
}

/** Read exam dates, rooms, or a calendar from a workbook. Identity columns are not returned. */
export function scanWorkbook(bytes: Uint8Array): ScheduleScan {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { note: "The workbook in local/ could not be read, so no school timetable was loaded.", exams: [] };
  }
  const strings = sharedStrings(files);
  let sawSchedule = false;
  for (const sheet of sheetsOf(files)) {
    const xmlBytes = files[sheet.path];
    if (!xmlBytes) continue;
    const headers = headerMap(strFromU8(xmlBytes), strings);
    const kinds = new Set(headers.values());
    if (kinds.has("date") || kinds.has("room") || kinds.has("calendar")) sawSchedule = true;
    if (kinds.has("date")) {
      const exams = examsFromSheet(xmlBytes ? strFromU8(xmlBytes) : "", strings, headers);
      strings.length = 0;
      return {
        note:
          exams.length > 0
            ? "Exam dates from the workbook are marked as parsed from the file."
            : "An exam-date column was found, but it had no dates, so no timetable was loaded.",
        exams,
      };
    }
  }
  strings.length = 0;
  if (sawSchedule) {
    return {
      note: "A room or calendar heading was found, but there is no exam-date column, so no timetable was loaded.",
      exams: [],
    };
  }
  return { note: NO_DATE, exams: [] };
}
