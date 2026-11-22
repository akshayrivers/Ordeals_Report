/** Maxima from the Yug register. Change one of these live if asked on the call. */
export const LIMITS = {
  formative: 5,
  coCurricular: 20,
  summative: 50,
} as const;

export const EXPECTED_HEADER = [
  "student_id",
  "class",
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
] as const;

export const EXPECTED_ROWS = 48;

const CARD_NAME: Record<string, string> = {
  English: "English",
  "Urdu/Hindi": "Hindi/Urdu",
  Mathematics: "Mathematics",
  Science: "Science/EVS",
  "Social Science": "Social Science",
  "Kashmiri/Dogri/Punjabi": "Dogri/Additional",
};

export const CARD_ORDER = [
  "English",
  "Urdu/Hindi",
  "Mathematics",
  "Science",
  "Social Science",
  "Kashmiri/Dogri/Punjabi",
] as const;

const MARK_FIELDS = [
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
] as const;

export type MarkField = (typeof MARK_FIELDS)[number];

export type MarkRow = {
  student_id: string;
  className: string;
  session: string;
  subject: string;
  f1: string;
  f2: string;
  f3: string;
  f4: string;
  f5: string;
  f6: string;
  fa_total: string;
  co_curricular: string;
  summative: string;
  subject_total: string;
  grand_total: string;
  grade: string;
  remark: string;
  source: string;
};

export type SubjectCell = {
  registerName: string;
  cardName: string;
  total: number | null;
  unused: boolean;
  reasons: string[];
  components: string;
};

export type StudentResult = {
  studentId: string;
  grade: string;
  grandTotal: number | null;
  countedTotal: number | null;
  countedMax: number;
  source: string;
  subjects: SubjectCell[];
  reasons: string[];
};

export type Report =
  | {
      ok: true;
      students: StudentResult[];
      unusedSubjects: string[];
      session: string;
      className: string;
    }
  | { ok: false; error: string };

function parseCsvTable(text: string): string[][] {
  const table: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) table.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) table.push(row);
  }
  return table;
}

function parseMark(raw: string): number | null {
  const text = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

function nearly(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function rowReasons(row: MarkRow): string[] {
  const label = CARD_NAME[row.subject] ?? row.subject;
  const reasons: string[] = [];
  if (row.student_id.trim() === "") reasons.push(`${label}: student id is blank`);

  const values: Partial<Record<MarkField, number>> = {};
  for (const field of MARK_FIELDS) {
    const parsed = parseMark(row[field]);
    if (parsed === null) {
      reasons.push(`${label}: ${field} is blank or not a number`);
    } else {
      values[field] = parsed;
    }
  }

  const fKeys = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;
  for (const key of fKeys) {
    const value = values[key];
    if (value !== undefined && (value < 0 || value > LIMITS.formative)) {
      reasons.push(`${label}: ${key.toUpperCase()} is ${value}, outside 0–${LIMITS.formative}`);
    }
  }
  if (values.co_curricular !== undefined && (values.co_curricular < 0 || values.co_curricular > LIMITS.coCurricular)) {
    reasons.push(`${label}: co-curricular is ${values.co_curricular}, outside 0–${LIMITS.coCurricular}`);
  }
  if (values.summative !== undefined && (values.summative < 0 || values.summative > LIMITS.summative)) {
    reasons.push(`${label}: summative is ${values.summative}, outside 0–${LIMITS.summative}`);
  }

  const fValues = fKeys.map((key) => values[key]);
  if (fValues.every((value) => value !== undefined) && values.fa_total !== undefined) {
    const sum = (fValues as number[]).reduce((total, value) => total + value, 0);
    if (!nearly(sum, values.fa_total)) {
      reasons.push(`${label}: formative total is ${values.fa_total}, the six F cells add to ${sum}`);
    }
  }
  if (
    values.fa_total !== undefined &&
    values.co_curricular !== undefined &&
    values.summative !== undefined &&
    values.subject_total !== undefined
  ) {
    const sum = values.fa_total + values.co_curricular + values.summative;
    if (!nearly(sum, values.subject_total)) {
      reasons.push(`${label}: subject total is ${values.subject_total}, the components add to ${sum}`);
    }
  }
  return reasons;
}

function isZeroBlock(row: MarkRow): boolean {
  return MARK_FIELDS.every((field) => parseMark(row[field]) === 0);
}

function componentLine(row: MarkRow): string {
  return `F ${row.f1} ${row.f2} ${row.f3} ${row.f4} ${row.f5} ${row.f6} · activities ${row.co_curricular} · summative ${row.summative}`;
}

export function checkCsv(text: string): Report {
  const table = parseCsvTable(text);
  if (table.length === 0) return { ok: false, error: "The file is empty." };

  const header = table[0].map((cell) => cell.trim());
  if (header.join(",") !== EXPECTED_HEADER.join(",")) {
    return {
      ok: false,
      error: `Header does not match data.csv. Expected ${EXPECTED_HEADER.join(",")}.`,
    };
  }

  const body = table.slice(1);
  if (body.length !== EXPECTED_ROWS) {
    return {
      ok: false,
      error: `Expected ${EXPECTED_ROWS} data rows, found ${body.length}.`,
    };
  }

  const rows: MarkRow[] = body.map((cells) => {
    const value = (index: number) => (cells[index] ?? "").trim();
    return {
      student_id: value(0),
      className: value(1),
      session: value(2),
      subject: value(3),
      f1: value(4),
      f2: value(5),
      f3: value(6),
      f4: value(7),
      f5: value(8),
      f6: value(9),
      fa_total: value(10),
      co_curricular: value(11),
      summative: value(12),
      subject_total: value(13),
      grand_total: value(14),
      grade: value(15),
      remark: value(16),
      source: value(17),
    };
  });

  const bySubject = new Map<string, MarkRow[]>();
  for (const row of rows) {
    const list = bySubject.get(row.subject) ?? [];
    list.push(row);
    bySubject.set(row.subject, list);
  }
  const unused = new Set(
    [...bySubject.entries()]
      .filter(([, list]) => list.length > 0 && list.every(isZeroBlock))
      .map(([subject]) => subject),
  );

  const byStudent = new Map<string, MarkRow[]>();
  for (const row of rows) {
    const list = byStudent.get(row.student_id) ?? [];
    list.push(row);
    byStudent.set(row.student_id, list);
  }

  const students: StudentResult[] = [...byStudent.entries()].map(([studentId, list]) => {
    const reasons = list.flatMap(rowReasons);
    const grades = [...new Set(list.map((row) => row.grade))];
    if (grades.length !== 1) reasons.push("grade is not the same on every subject row");
    const grands = [...new Set(list.map((row) => row.grand_total))];
    if (grands.length !== 1) reasons.push("grand total is not the same on every subject row");

    const byName = new Map(list.map((row) => [row.subject, row]));
    const subjects: SubjectCell[] = CARD_ORDER.map((registerName) => {
      const row = byName.get(registerName);
      const cardName = CARD_NAME[registerName] ?? registerName;
      if (!row) {
        return {
          registerName,
          cardName,
          total: null,
          unused: unused.has(registerName),
          reasons: [`${cardName}: missing row`],
          components: "",
        };
      }
      return {
        registerName,
        cardName,
        total: parseMark(row.subject_total),
        unused: unused.has(registerName),
        reasons: rowReasons(row),
        components: componentLine(row),
      };
    });
    for (const subject of subjects) {
      if (subject.total === null && !reasons.some((reason) => reason.startsWith(subject.cardName))) {
        reasons.push(`${subject.cardName}: missing row`);
      }
    }

    const used = subjects.filter((subject) => !subject.unused);
    const countedMax = used.length * 100;
    const totals = subjects.map((subject) => subject.total);
    const grand = parseMark(list[0]?.grand_total ?? "");
    if (totals.every((total) => total !== null) && grand !== null) {
      const sum = (totals as number[]).reduce((total, value) => total + value, 0);
      if (!nearly(sum, grand)) {
        reasons.push(`grand total is ${grand}, the six subjects add to ${sum}`);
      }
    }

    const countedValues = used.map((subject) => subject.total);
    const countedTotal = countedValues.every((total) => total !== null)
      ? (countedValues as number[]).reduce((total, value) => total + value, 0)
      : null;

    return {
      studentId,
      grade: grades.length === 1 ? grades[0] : grades.filter(Boolean).join(" / "),
      grandTotal: grand,
      countedTotal,
      countedMax,
      source: list[0]?.source ?? "",
      subjects,
      reasons,
    };
  });

  const sessions = [...new Set(rows.map((row) => row.session))];
  const classes = [...new Set(rows.map((row) => row.className))];

  return {
    ok: true,
    students,
    unusedSubjects: [...unused],
    session: sessions.length === 1 ? sessions[0] : sessions.join(", "),
    className: classes.length === 1 ? classes[0] : classes.join(", "),
  };
}
