import rawCsv from "../data.csv?raw";
import fathersCsv from "../placeholders/fathers.csv?raw";
import { SCHOOL_LAYOUT, type CardLayout } from "./cards";
import { checkCsv, type Report } from "./check";
import { parseFathers } from "./fathers";
import type { CustomWeights, PatternId } from "./pattern";
import type { ExamRow } from "./schedule";
import type { MarkStore } from "./store";

export const bundledCsv = rawCsv;
export const fathers = parseFathers(fathersCsv);

export const state: {
  report: Report;
  sourceLabel: string;
  notes: string[];
  patternId: PatternId;
  weights: CustomWeights;
  layout: CardLayout;
  exams: ExamRow[];
  dbNote: string;
  importError: string;
} = {
  report: checkCsv(rawCsv),
  sourceLabel: "data.csv",
  notes: [],
  patternId: "register",
  weights: { fa: 30, activities: 20, summative: 50 },
  layout: { ...SCHOOL_LAYOUT },
  exams: [],
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
