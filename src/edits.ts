import type { MarkRow } from "./check";

const FORMATIVE = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;

function numeric(value: string): number | null {
  const text = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

function recomputeGrand(rows: MarkRow[]): void {
  const totals = rows.map((row) => numeric(row.subject_total));
  if (totals.some((total) => total === null)) return;
  const grand = String((totals as number[]).reduce((sum, value) => sum + value, 0));
  for (const row of rows) row.grand_total = grand;
}

/** Change one stored mark. Totals follow the components. The grade changes only when that field is edited. */
export function editMark(rows: MarkRow[], studentId: string, subject: string, field: string, value: string): MarkRow[] {
  const next = rows.map((row) => ({ ...row }));
  const mine = next.filter((row) => row.student_id === studentId);
  if (field === "grade" || field === "grand_total") {
    for (const row of mine) {
      if (field === "grade") row.grade = value;
      else row.grand_total = value;
    }
    return next;
  }
  const row = mine.find((item) => item.subject === subject);
  if (!row || !(field in row)) return next;
  (row as unknown as Record<string, string>)[field] = value;
  if (FORMATIVE.includes(field as (typeof FORMATIVE)[number])) {
    const parts = FORMATIVE.map((key) => numeric(row[key]));
    if (parts.every((part) => part !== null)) {
      row.fa_total = String((parts as number[]).reduce((sum, part) => sum + part, 0));
    }
  }
  if (
    FORMATIVE.includes(field as (typeof FORMATIVE)[number]) ||
    field === "fa_total" ||
    field === "co_curricular" ||
    field === "summative"
  ) {
    const fa = numeric(row.fa_total);
    const activities = numeric(row.co_curricular);
    const summative = numeric(row.summative);
    if (fa !== null && activities !== null && summative !== null) {
      row.subject_total = String(fa + activities + summative);
    }
    recomputeGrand(mine);
  } else if (field === "subject_total") {
    recomputeGrand(mine);
  }
  return next;
}
