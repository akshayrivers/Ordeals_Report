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
  u1: string;
  u2: string;
  t1: string;
  t2: string;
};

export type MarkParts = {
  f1: number | null;
  f2: number | null;
  f3: number | null;
  f4: number | null;
  f5: number | null;
  f6: number | null;
  fa: number | null;
  activities: number | null;
  summative: number | null;
};

export type SubjectCell = {
  registerName: string;
  cardName: string;
  total: number | null;
  unused: boolean;
  reasons: string[];
  components: string;
  marks: MarkParts;
  extras: {
    u1: number | null;
    u2: number | null;
    t1: number | null;
    t2: number | null;
  };
};

export type StudentResult = {
  studentId: string;
  className: string;
  grade: string;
  grandTotal: number | null;
  countedTotal: number | null;
  countedMax: number;
  source: string;
  remark: string;
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

export function parseCsvTable(text: string, keepEmpty = false): string[][] {
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
      if (keepEmpty || row.some((cell) => cell !== "")) table.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (keepEmpty || row.some((cell) => cell !== "")) table.push(row);
  }
  if (keepEmpty) {
    while (table.length > 0 && table[table.length - 1].every((cell) => cell === "")) table.pop();
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

function optionalMark(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  return parseMark(raw);
}

function extrasOf(row: MarkRow | undefined): SubjectCell["extras"] {
  return {
    u1: optionalMark(row?.u1),
    u2: optionalMark(row?.u2),
    t1: optionalMark(row?.t1),
    t2: optionalMark(row?.t2),
  };
}

function sameMarks(a: MarkRow, b: MarkRow): boolean {
  const fields = [...MARK_FIELDS, "grand_total", "grade", "u1", "u2", "t1", "t2"] as const;
  return fields.every((field) => a[field] === b[field]);
}

function duplicateReasons(list: MarkRow[]): string[] {
  const reasons: string[] = [];
  const seen = new Map<string, MarkRow>();
  for (const row of list) {
    const prev = seen.get(row.subject);
    if (!prev) {
      seen.set(row.subject, row);
      continue;
    }
    const label = CARD_NAME[row.subject] ?? row.subject;
    reasons.push(
      sameMarks(prev, row)
        ? `${label}: duplicate row, not merged`
        : `${label}: two rows disagree, not merged`,
    );
  }
  return reasons;
}

function marksOf(row: MarkRow | undefined): MarkParts {
  if (!row) {
    return {
      f1: null,
      f2: null,
      f3: null,
      f4: null,
      f5: null,
      f6: null,
      fa: null,
      activities: null,
      summative: null,
    };
  }
  return {
    f1: parseMark(row.f1),
    f2: parseMark(row.f2),
    f3: parseMark(row.f3),
    f4: parseMark(row.f4),
    f5: parseMark(row.f5),
    f6: parseMark(row.f6),
    fa: parseMark(row.fa_total),
    activities: parseMark(row.co_curricular),
    summative: parseMark(row.summative),
  };
}

function componentLine(row: MarkRow): string {
  return `F ${row.f1} ${row.f2} ${row.f3} ${row.f4} ${row.f5} ${row.f6} · activities ${row.co_curricular} · summative ${row.summative}`;
}

export function rowsFromCanonical(text: string): { ok: true; rows: MarkRow[] } | { ok: false; error: string } {
  const table = parseCsvTable(text);
  if (table.length === 0) return { ok: false, error: "The file is empty." };

  const header = table[0].map((cell) => cell.trim());
  if (header.join(",") !== EXPECTED_HEADER.join(",")) {
    return {
      ok: false,
      error: `Header does not match data.csv. Expected ${EXPECTED_HEADER.join(",")}.`,
    };
  }

  const rows: MarkRow[] = table.slice(1).map((cells) => {
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
      u1: "",
      u2: "",
      t1: "",
      t2: "",
    };
  });
  return { ok: true, rows };
}

export function checkCsv(text: string): Report {
  const parsed = rowsFromCanonical(text);
  if (!parsed.ok) return parsed;
  if (parsed.rows.length !== EXPECTED_ROWS) {
    return {
      ok: false,
      error: `Expected ${EXPECTED_ROWS} data rows, found ${parsed.rows.length}.`,
    };
  }
  return checkRows(parsed.rows);
}

export function checkRows(rows: MarkRow[]): Report {
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
    const reasons = [...list.flatMap(rowReasons), ...duplicateReasons(list)];
    const grades = [...new Set(list.map((row) => row.grade))];
    if (grades.length !== 1) reasons.push("grade is not the same on every subject row");
    const grands = [...new Set(list.map((row) => row.grand_total))];
    if (grands.length !== 1) reasons.push("grand total is not the same on every subject row");

    const byName = new Map<string, MarkRow>();
    for (const row of list) {
      if (!byName.has(row.subject)) byName.set(row.subject, row);
    }
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
          marks: marksOf(undefined),
          extras: extrasOf(undefined),
        };
      }
      return {
        registerName,
        cardName,
        total: parseMark(row.subject_total),
        unused: unused.has(registerName),
        reasons: rowReasons(row),
        components: componentLine(row),
        marks: marksOf(row),
        extras: extrasOf(row),
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

    const classNames = [...new Set(list.map((row) => row.className))];
    return {
      studentId,
      className: classNames.length === 1 ? classNames[0] : classNames.join(", "),
      grade: grades.length === 1 ? grades[0] : grades.filter(Boolean).join(" / "),
      grandTotal: grand,
      countedTotal,
      countedMax,
      source: list[0]?.source ?? "",
      remark: new Set(list.map((row) => row.remark)).size === 1 ? (list[0]?.remark ?? "") : "",
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

function subjectIsZero(subject: SubjectCell): boolean {
  const marks = subject.marks;
  return (
    subject.total === 0 &&
    [marks.f1, marks.f2, marks.f3, marks.f4, marks.f5, marks.f6, marks.fa, marks.activities, marks.summative].every(
      (value) => value === 0,
    )
  );
}

/** Unused means every student in this group stored that subject as zero. */
export function applyClassUnused(students: StudentResult[]): StudentResult[] {
  if (students.length === 0) return [];
  const names = students[0].subjects.map((subject) => subject.registerName);
  const unused = new Set(
    names.filter((name) =>
      students.every((student) => {
        const subject = student.subjects.find((item) => item.registerName === name);
        return subject ? subjectIsZero(subject) : false;
      }),
    ),
  );
  return students.map((student) => {
    const subjects = student.subjects.map((subject) => ({
      ...subject,
      unused: unused.has(subject.registerName),
    }));
    const used = subjects.filter((subject) => !subject.unused);
    const countedTotal = used.every((subject) => subject.total !== null)
      ? used.reduce((total, subject) => total + (subject.total ?? 0), 0)
      : null;
    return {
      ...student,
      subjects,
      countedMax: used.length * 100,
      countedTotal,
    };
  });
}

export function presentForPrint(students: StudentResult[]): StudentResult[] {
  const byClass = new Map<string, StudentResult[]>();
  for (const student of students) {
    const list = byClass.get(student.className) ?? [];
    list.push(student);
    byClass.set(student.className, list);
  }
  const adjusted = new Map<string, StudentResult>();
  for (const group of byClass.values()) {
    for (const student of applyClassUnused(group)) adjusted.set(student.studentId, student);
  }
  return students.map((student) => adjusted.get(student.studentId) ?? student);
}
