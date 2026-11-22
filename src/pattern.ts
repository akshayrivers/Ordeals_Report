import type { StudentResult, SubjectCell } from "./check";

export type PatternId = "register" | "u1" | "terms" | "fa-sa" | "custom";

export type WeightKey = "fa" | "activities" | "summative" | "u1" | "u2" | "t1" | "t2";

export type WeightPart = {
  key: WeightKey;
  label: string;
  max: number;
  weight: number;
};

export type CustomWeights = {
  fa: number;
  activities: number;
  summative: number;
  u1: number;
  u2: number;
  t1: number;
  t2: number;
};

export type ResolvedPattern = {
  id: PatternId;
  label: string;
  parts: WeightPart[];
  weightSum: number;
  usesRegisterGrade: boolean;
  missing: string[];
  note: string;
};

export type ScoreLine = {
  studentId: string;
  total: number | null;
  rank: number | null;
  sheetGrade: string;
};

export const PATTERN_CHOICES: { id: PatternId; label: string }[] = [
  { id: "register", label: "Register (F1–F6 + activities + summative)" },
  { id: "u1", label: "U1 only" },
  { id: "terms", label: "U1 / U2 / T1 / T2" },
  { id: "fa-sa", label: "FA / SA" },
  { id: "custom", label: "Custom weights" },
];

const REGISTER_PARTS: WeightPart[] = [
  { key: "fa", label: "Formative (F1–F6)", max: 30, weight: 30 },
  { key: "activities", label: "Co-curricular", max: 20, weight: 20 },
  { key: "summative", label: "Summative", max: 50, weight: 50 },
];

const U1_PARTS: WeightPart[] = [{ key: "u1", label: "U1", max: 25, weight: 100 }];

const TERM_PARTS: WeightPart[] = [
  { key: "u1", label: "U1", max: 25, weight: 25 },
  { key: "u2", label: "U2", max: 25, weight: 25 },
  { key: "t1", label: "T1", max: 25, weight: 25 },
  { key: "t2", label: "T2", max: 25, weight: 25 },
];

const FA_SA_PARTS: WeightPart[] = [
  { key: "fa", label: "FA (formative total on this file)", max: 30, weight: 40 },
  { key: "summative", label: "SA (summative on this file)", max: 50, weight: 60 },
];

export function weightSum(parts: WeightPart[]): number {
  return parts.reduce((total, part) => total + part.weight, 0);
}

function columnPresent(students: StudentResult[], key: WeightKey): boolean {
  return students.some((student) => student.subjects.some((subject) => partValue(subject, key) !== null));
}

function missingLabels(students: StudentResult[], parts: WeightPart[]): string[] {
  return parts.filter((part) => !columnPresent(students, part.key)).map((part) => part.label);
}

function absentNote(missing: string[], ready: string): string {
  if (missing.length === 0) return ready;
  const verb = missing.length === 1 ? "is" : "are";
  return `${missing.join(", ")} ${verb} not in this file. No total was invented. The grade on the sheet is not recomputed.`;
}

export function resolvePattern(id: PatternId, custom: CustomWeights, students: StudentResult[]): ResolvedPattern {
  if (id === "register") {
    const parts = REGISTER_PARTS;
    return {
      id,
      label: "Register (F1–F6 + activities + summative)",
      parts,
      weightSum: weightSum(parts),
      usesRegisterGrade: true,
      missing: [],
      note: "This matches the 2023-24 register: formative max 30, co-curricular max 20, summative max 50. The total is the grand total on the sheet. The grade is the grade on the sheet.",
    };
  }
  if (id === "u1") {
    const parts = U1_PARTS;
    const missing = missingLabels(students, parts);
    return {
      id,
      label: "U1 only",
      parts,
      weightSum: weightSum(parts),
      usesRegisterGrade: false,
      missing,
      note: absentNote(
        missing,
        "U1 is in this file, out of 25. Weight 100 is this control, not a scale written on the register. The grade on the sheet is not recomputed.",
      ),
    };
  }
  if (id === "terms") {
    const parts = TERM_PARTS;
    const missing = missingLabels(students, parts);
    return {
      id,
      label: "U1 / U2 / T1 / T2",
      parts,
      weightSum: weightSum(parts),
      usesRegisterGrade: false,
      missing,
      note: absentNote(
        missing,
        "U1, U2, T1, and T2 are in this file, each out of 25. Weights 25+25+25+25 are this control, not a scale from the register. The grade on the sheet is not recomputed.",
      ),
    };
  }
  if (id === "fa-sa") {
    const parts = FA_SA_PARTS;
    const missing = missingLabels(students, parts);
    return {
      id,
      label: "FA / SA",
      parts,
      weightSum: weightSum(parts),
      usesRegisterGrade: false,
      missing,
      note: absentNote(
        missing,
        "FA uses the formative total already in the file. SA uses the summative already in the file. Weights 40 and 60 are this control, not written on the register. The total is shown from those two columns. The grade on the sheet is not recomputed.",
      ),
    };
  }
  const catalog: WeightPart[] = [
    { key: "fa", label: "Formative (F1–F6)", max: 30, weight: custom.fa },
    { key: "activities", label: "Co-curricular", max: 20, weight: custom.activities },
    { key: "summative", label: "Summative", max: 50, weight: custom.summative },
    { key: "u1", label: "U1", max: 25, weight: custom.u1 },
    { key: "u2", label: "U2", max: 25, weight: custom.u2 },
    { key: "t1", label: "T1", max: 25, weight: custom.t1 },
    { key: "t2", label: "T2", max: 25, weight: custom.t2 },
  ];
  const parts = catalog.filter((part) => columnPresent(students, part.key));
  const absent = catalog.filter((part) => !columnPresent(students, part.key)).map((part) => part.label);
  const ready =
    absent.length === 0
      ? "These weights apply to columns already in the file. The grade on the sheet is not recomputed."
      : `The total uses only columns in this file. ${absent.join(", ")} ${absent.length === 1 ? "is" : "are"} left out. The grade on the sheet is not recomputed.`;
  return {
    id: "custom",
    label: "Custom weights",
    parts,
    weightSum: weightSum(parts),
    usesRegisterGrade: false,
    missing: parts.length === 0 ? absent : [],
    note: parts.length === 0 ? absentNote(absent, ready) : ready,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function partValue(subject: SubjectCell, key: WeightKey): number | null {
  if (key === "fa") return subject.marks.fa;
  if (key === "activities") return subject.marks.activities;
  if (key === "summative") return subject.marks.summative;
  return subject.extras[key];
}

function subjectScore(subject: SubjectCell, parts: WeightPart[]): number | null {
  let score = 0;
  for (const part of parts) {
    const value = partValue(subject, part.key);
    if (value === null || part.max === 0) return null;
    score += (value / part.max) * part.weight;
  }
  return score;
}

export function scoreReport(students: StudentResult[], pattern: ResolvedPattern): ScoreLine[] {
  const lines: ScoreLine[] = students.map((student) => {
    if (pattern.missing.length > 0) {
      return { studentId: student.studentId, total: null, rank: null, sheetGrade: student.grade };
    }
    if (pattern.id === "register") {
      return { studentId: student.studentId, total: student.grandTotal, rank: null, sheetGrade: student.grade };
    }
    let sum = 0;
    for (const subject of student.subjects) {
      const score = subjectScore(subject, pattern.parts);
      if (score === null) {
        return { studentId: student.studentId, total: null, rank: null, sheetGrade: student.grade };
      }
      sum += score;
    }
    return { studentId: student.studentId, total: round2(sum), rank: null, sheetGrade: student.grade };
  });

  const ranked = lines.filter((line): line is ScoreLine & { total: number } => line.total !== null);
  ranked.sort((a, b) => b.total - a.total || a.studentId.localeCompare(b.studentId));
  let last: number | null = null;
  let rank = 0;
  ranked.forEach((line, index) => {
    if (last === null || line.total !== last) {
      rank = index + 1;
      last = line.total;
    }
    const target = lines.find((item) => item.studentId === line.studentId);
    if (target) target.rank = rank;
  });
  return lines;
}

export function formatTotal(value: number | null): string {
  if (value === null) return "—";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}
