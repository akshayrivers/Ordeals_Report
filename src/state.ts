import rawCsv from "../data.csv?raw";
import demoExamsCsv from "../dummy/exams.csv?raw";
import demoFathersCsv from "../dummy/fathers.csv?raw";
import demoCsv from "../dummy/school.csv?raw";
import fathersCsv from "../placeholders/fathers.csv?raw";
import { SCHOOL_LAYOUT, type CardLayout } from "./cards";
import { checkCsv, checkRows, parseCsvTable, rowsFromCanonical, type MarkRow, type Report } from "./check";
import { parseFathers } from "./fathers";
import type { CustomWeights, PatternId } from "./pattern";
import { prepareExam, type ExamRow } from "./schedule";
import type { ExtraColumn, ExtraValues, MarkStore, WorkingCopy } from "./store";

export const bundledCsv = rawCsv;
export const registerFathers = parseFathers(fathersCsv);
export const demoFathers = parseFathers(demoFathersCsv);
export const fathers = registerFathers;

export type DatasetId = "demo" | "register";

const NO_DATE =
  "The workbook in local/ has no exam-date column, so no school timetable was loaded.";

const BLOCKED_FIELD =
  /aadhaar|uidai|phone|mobile|contact|address|dob|birth|father|mother|parent|student name|^name$|photograph|^photo$/i;

function cloneRow(row: MarkRow): MarkRow {
  return { ...row };
}

function fileRows(text: string): MarkRow[] {
  const parsed = rowsFromCanonical(text);
  if (!parsed.ok) return [];
  return parsed.rows.map(cloneRow);
}

const demoFileRows = fileRows(demoCsv);
const registerFileRows = fileRows(rawCsv);

function loadDemoExams(text: string): ExamRow[] {
  const table = parseCsvTable(text);
  return table.slice(1).map((cells, index) =>
    prepareExam(
      {
        className: (cells[0] ?? "").trim(),
        subject: (cells[1] ?? "").trim(),
        date: (cells[2] ?? "").trim(),
        room: (cells[3] ?? "").trim(),
        origin: "dummy",
      },
      10000 + index,
    ),
  );
}

type Memory = WorkingCopy;

const memory: Record<DatasetId, Memory> = {
  demo: { rows: null, columns: [], values: {} },
  register: { rows: null, columns: [], values: {} },
};

export const state: {
  dataset: DatasetId;
  rows: MarkRow[];
  report: Report;
  sourceLabel: string;
  notes: string[];
  patternId: PatternId;
  weights: CustomWeights;
  layout: CardLayout;
  exams: ExamRow[];
  demoExams: ExamRow[];
  parsedExams: ExamRow[];
  scheduleNote: string;
  extras: { columns: ExtraColumn[]; values: ExtraValues };
  dbNote: string;
  importError: string;
} = {
  dataset: "demo",
  rows: demoFileRows.map(cloneRow),
  report: checkRows(demoFileRows),
  sourceLabel: "dummy/school.csv",
  notes: [
    "Demo classes 1–8 are made up so the screens can be tried. They were not collected at the school. data.csv is not changed.",
  ],
  patternId: "register",
  weights: { fa: 30, activities: 20, summative: 50, u1: 0, u2: 0, t1: 0, t2: 0 },
  layout: { ...SCHOOL_LAYOUT },
  exams: [],
  demoExams: loadDemoExams(demoExamsCsv),
  parsedExams: [],
  scheduleNote: NO_DATE,
  extras: { columns: [], values: {} },
  dbNote: "",
  importError: "",
};

export let store: MarkStore | null = null;

export function setStore(next: MarkStore | null): void {
  store = next;
}

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function publish(): void {
  for (const fn of [...listeners]) fn();
}

export function fatherMap(): Record<string, string> {
  return state.dataset === "demo" ? demoFathers : registerFathers;
}

export function visibleExams(): ExamRow[] {
  if (state.dataset === "demo") return [...state.parsedExams, ...state.demoExams, ...state.exams];
  return [...state.parsedExams, ...state.exams];
}

const COMPONENT_KEYS = ["u1", "u2", "t1", "t2"] as const;

function fillBlankComponents(rows: MarkRow[], file: MarkRow[]): MarkRow[] {
  const byKey = new Map(file.map((row) => [`${row.student_id}\u0000${row.subject}`, row]));
  return rows.map((row) => {
    const source = byKey.get(`${row.student_id}\u0000${row.subject}`);
    if (!source) return row;
    const blank = COMPONENT_KEYS.every((key) => row[key].trim() === "");
    const fileHas = COMPONENT_KEYS.some((key) => source[key].trim() !== "");
    if (!blank || !fileHas) return row;
    return { ...row, u1: source.u1, u2: source.u2, t1: source.t1, t2: source.t2 };
  });
}

function applyMemory(id: DatasetId): void {
  const saved = memory[id];
  const base = (saved.rows ?? (id === "demo" ? demoFileRows : registerFileRows)).map(cloneRow);
  const rows = id === "demo" ? fillBlankComponents(base, demoFileRows) : base;
  state.dataset = id;
  state.rows = rows;
  state.extras = {
    columns: saved.columns.map((column) => ({ ...column })),
    values: structuredClone(saved.values),
  };
  state.sourceLabel = id === "demo" ? "dummy/school.csv" : "data.csv";
  state.report = id === "register" && saved.rows === null ? checkCsv(rawCsv) : checkRows(rows);
  state.importError = "";
}

export function showDataset(id: DatasetId): void {
  applyMemory(id);
  state.notes =
    id === "demo"
      ? [
          "Demo classes 1–8 are made up so the screens can be tried. They were not collected at the school. data.csv is not changed.",
        ]
      : ["Real class 8 register from data.csv. Session 2023-24. The file on disk is not changed by edits in the browser."];
  publish();
}

function remember(): void {
  const current = memory[state.dataset];
  current.rows = state.rows.map(cloneRow);
  current.columns = state.extras.columns.map((column) => ({ ...column }));
  current.values = structuredClone(state.extras.values);
}

function persist(): void {
  const copy = memory[state.dataset];
  void store?.saveWorking(state.dataset, {
    rows: copy.rows ? copy.rows.map(cloneRow) : null,
    columns: copy.columns.map((column) => ({ ...column })),
    values: structuredClone(copy.values),
  });
}

export function replaceWorkingRows(rows: MarkRow[], label: string, notes: string[]): void {
  state.rows = rows.map(cloneRow);
  state.sourceLabel = label;
  state.notes = notes;
  state.importError = "";
  state.report = checkRows(state.rows);
  remember();
  publish();
  persist();
}

export function editWorkingRows(rows: MarkRow[]): void {
  state.rows = rows.map(cloneRow);
  state.report = checkRows(state.rows);
  remember();
  publish();
  persist();
}

export function rowKey(studentId: string, subject: string): string {
  return `${studentId}\u0000${subject}`;
}

export function blockedExtraValue(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 12 && digits.length <= 16) return true;
  return /^[6-9]\d{9}$/.test(digits);
}

export function addExtraColumn(label: string): string | null {
  const clean = label.trim();
  if (!clean) return "Type a field name first.";
  if (BLOCKED_FIELD.test(clean)) {
    return "That field is not stored. Names, Aadhaar, phone, address, and date of birth stay out of this page.";
  }
  const key = clean.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!key) return "Type a field name first.";
  if (state.extras.columns.some((column) => column.key === key)) return "That field is already on the table.";
  state.extras.columns = [...state.extras.columns, { key, label: clean }];
  remember();
  publish();
  persist();
  return null;
}

export function setExtraValue(key: string, field: string, value: string): string | null {
  if (blockedExtraValue(value)) return "That value looks like an Aadhaar or phone number, so it was not stored.";
  const values = { ...state.extras.values, [key]: { ...state.extras.values[key], [field]: value } };
  state.extras = { columns: state.extras.columns, values };
  remember();
  publish();
  persist();
  return null;
}

export async function restoreRegister(): Promise<void> {
  memory.register = { rows: null, columns: [], values: {} };
  await store?.clearWorking("register");
  await store?.clearMarks();
  applyMemory("register");
  state.notes = [
    "Showing data.csv again. Stored edits for the real register were cleared from the browser database. The file on disk was not changed.",
  ];
  publish();
}

export function adoptWorking(id: DatasetId, copy: WorkingCopy): void {
  memory[id] = {
    rows: copy.rows ? copy.rows.map(cloneRow) : null,
    columns: copy.columns.map((column) => ({ ...column })),
    values: structuredClone(copy.values),
  };
  if (state.dataset === id) applyMemory(id);
}
