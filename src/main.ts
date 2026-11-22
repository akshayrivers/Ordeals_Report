import rawCsv from "../data.csv?raw";
import fathersCsv from "../placeholders/fathers.csv?raw";
import { SCHOOL_LAYOUT, buildCards, type CardLayout } from "./cards";
import { CARD_ORDER, LIMITS, checkCsv, checkRows, type Report, type StudentResult } from "./check";
import { parseFathers } from "./fathers";
import { ingestCsv, ingestXlsx, scrubSecrets } from "./ingest";
import {
  PATTERN_CHOICES,
  formatTotal,
  resolvePattern,
  scoreReport,
  type CustomWeights,
  type PatternId,
  type ScoreLine,
} from "./pattern";
import { examConflicts, examDateText, prepareExam, type ExamRow } from "./schedule";
import { openStore, type MarkStore } from "./store";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app");

const fathers = parseFathers(fathersCsv);

const CARD_LABEL: Record<(typeof CARD_ORDER)[number], string> = {
  English: "English",
  "Urdu/Hindi": "Hindi/Urdu",
  Mathematics: "Mathematics",
  Science: "Science/EVS",
  "Social Science": "Social Science",
  "Kashmiri/Dogri/Punjabi": "Dogri/Additional",
};

const state: {
  report: Report;
  sourceLabel: string;
  notes: string[];
  patternId: PatternId;
  weights: CustomWeights;
  layout: CardLayout;
  exams: ExamRow[];
  dbNote: string;
} = {
  report: checkCsv(rawCsv),
  sourceLabel: "data.csv",
  notes: [],
  patternId: "register",
  weights: { fa: 30, activities: 20, summative: 50 },
  layout: { ...SCHOOL_LAYOUT },
  exams: [],
  dbNote: "",
};

let store: MarkStore | null = null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function patternNow() {
  const students = state.report.ok ? state.report.students : [];
  return resolvePattern(state.patternId, state.weights, students);
}

function scoresNow(): ScoreLine[] {
  if (!state.report.ok) return [];
  return scoreReport(state.report.students, patternNow());
}

const notesEl = el("div", "notes");
const bannerEl = el("p", "banner");
const metaEl = el("p", "meta");
const patternSummary = el("p", "pattern-summary");
const studentsEl = el("div", "students");
const examList = el("div", "exam-list");
const examError = el("p", "exam-error");
const preview = el("iframe", "preview");
preview.title = "Report card preview";
preview.hidden = true;

function paintNotes(): void {
  notesEl.replaceChildren();
  if (state.dbNote) notesEl.append(el("p", undefined, state.dbNote));
  for (const note of state.notes) notesEl.append(el("p", undefined, note));
  notesEl.hidden = notesEl.childElementCount === 0;
}

function paintBanner(): void {
  const report = state.report;
  if (!report.ok) {
    bannerEl.className = "banner bad";
    bannerEl.textContent = report.error;
    metaEl.textContent = "";
    return;
  }
  const unusedNames = report.unusedSubjects.map(
    (subject) => CARD_LABEL[subject as (typeof CARD_ORDER)[number]] ?? subject,
  );
  const unsafeStudents = report.students.filter((student) => student.reasons.length > 0);
  bannerEl.className = unsafeStudents.length ? "banner bad" : "banner ok";
  const parts: string[] = [];
  if (unusedNames.length) {
    parts.push(
      `${unusedNames.join(", ")} is 0 for every student, so the counted total is out of ${report.students[0]?.countedMax ?? 500}, not 600.`,
    );
  }
  parts.push(
    unsafeStudents.length
      ? `${unsafeStudents.length} student${unsafeStudents.length === 1 ? "" : "s"} failed a check.`
      : "No row failed the arithmetic.",
  );
  bannerEl.textContent = parts.join(" ");
  metaEl.textContent = `Class ${report.className} · session ${report.session} · ${report.students.length} students · ${state.sourceLabel} · F max ${LIMITS.formative}, activities max ${LIMITS.coCurricular}, summative max ${LIMITS.summative}`;
}

function paintPattern(): void {
  const pattern = patternNow();
  const weights = pattern.parts
    .map((part) => `${part.label}: weight ${part.weight}, max ${part.max}`)
    .join(" · ");
  patternSummary.textContent = `${weights}. Weights sum to ${pattern.weightSum}. ${pattern.note}`;
  const custom = document.querySelector<HTMLDivElement>("#custom-weights");
  if (custom) custom.hidden = state.patternId !== "custom";
}

function paintStudents(): void {
  studentsEl.replaceChildren();
  if (!state.report.ok) return;
  const scores = scoresNow();
  for (const student of state.report.students) {
    const score = scores.find((line) => line.studentId === student.studentId);
    studentsEl.append(renderStudent(student, score));
  }
}

function paintExams(): void {
  examList.replaceChildren();
  examError.textContent = "";
  if (state.exams.length === 0) {
    examList.append(
      el("p", "quiet", "No exams yet. Nothing here was copied from a school timetable."),
    );
    return;
  }
  const clashes = examConflicts(state.exams);
  if (clashes.length === 0) {
    examList.append(el("p", "banner ok", "No room or class clash in these rows."));
  } else {
    const box = el("div", "banner bad");
    for (const clash of clashes) box.append(el("p", undefined, clash));
    examList.append(box);
  }
  const list = el("ul", "exams");
  for (const exam of state.exams) {
    const room = exam.room ? `Room ${exam.room}` : "Room is blank, so this row is not part of a room check.";
    const item = el("li");
    item.textContent = `Class ${exam.className} · ${exam.subject} · ${examDateText(exam)} · ${room}`;
    list.append(item);
  }
  examList.append(list);
}

function paint(): void {
  paintNotes();
  paintBanner();
  paintPattern();
  paintStudents();
  paintExams();
}

function renderStudent(student: StudentResult, score: ScoreLine | undefined): HTMLElement {
  const card = el("article", student.reasons.length ? "student unsafe" : "student");
  const top = el("div", "top");
  const who = el("div");
  const father = fathers[student.studentId];
  who.append(el("h2", undefined, student.studentId), el("p", "src", student.source));
  if (father) who.append(el("p", "src", `Father's name placeholder: ${father}`));
  const scoreBox = el("div", "score");
  scoreBox.append(
    el("span", "grade", student.grade || "—"),
    el("span", "sheet", student.grandTotal === null ? "—" : `${student.grandTotal} on the sheet`),
    el(
      "span",
      "counted",
      student.countedTotal === null ? "—" : `${student.countedTotal} / ${student.countedMax}`,
    ),
  );
  if (score?.rank) scoreBox.append(el("span", "rank", `Rank ${score.rank}`));
  if (state.patternId !== "register") {
    scoreBox.append(
      el(
        "span",
        "weighted",
        score && score.total !== null ? `Weighted ${formatTotal(score.total)}` : "No weighted total",
      ),
    );
  }
  top.append(
    who,
    scoreBox,
    el("p", student.reasons.length ? "check bad" : "check", student.reasons.length ? student.reasons.join(" ") : "Totals match"),
  );
  card.append(top);

  const subjects = el("ul", "subjects");
  for (const subject of student.subjects) {
    const item = el("li", subject.unused ? "unused" : undefined);
    item.append(
      el("span", "name", subject.cardName),
      el("b", undefined, subject.total === null ? "—" : String(subject.total)),
      el("small", undefined, subject.components || "no row"),
    );
    subjects.append(item);
  }
  card.append(subjects);
  return card;
}

function showReport(report: Report, sourceLabel: string, notes: string[]): void {
  state.report = report;
  state.sourceLabel = sourceLabel;
  state.notes = notes;
  preview.hidden = true;
  paint();
}

async function takeFile(file: File): Promise<void> {
  bannerEl.className = "banner";
  bannerEl.textContent = `Reading ${file.name} on this computer…`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await new Promise((resolve) => setTimeout(resolve, 0));
  const xlsx = file.name.toLowerCase().endsWith(".xlsx") || (bytes[0] === 0x50 && bytes[1] === 0x4b);
  const result = xlsx ? ingestXlsx(bytes.buffer) : ingestCsv(new TextDecoder().decode(bytes));
  if (!result.ok) {
    state.notes = result.notes;
    state.report = { ok: false, error: result.error };
    state.sourceLabel = file.name;
    paint();
    return;
  }
  const scrubbed = scrubSecrets(result.rows);
  const notes = [...result.notes];
  if (scrubbed.scrubbed) {
    notes.push("A phone-shaped or 12-digit number was in a kept cell and was left blank.");
  }
  let rows = scrubbed.rows;
  if (store) {
    try {
      const saved = await store.replaceMarks(rows, notes);
      rows = saved.rows;
      notes.push(
        store.persistent
          ? `Stored ${rows.length} mark rows in the browser database on this computer.`
          : `Kept ${rows.length} mark rows in memory for this page. The browser database did not save them.`,
      );
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "The rows were not saved in the browser database.");
    }
  }
  if (result.shape === "canonical-csv") {
    showReport(checkCsv(new TextDecoder().decode(bytes)), file.name, notes);
    return;
  }
  showReport(checkRows(rows), file.name, notes);
}

function mount(): void {
  app!.replaceChildren();
  const header = el("header", "mast");
  header.append(
    el("p", "eyebrow", "Govt. Middle School Yug · Zone Jib · for Suresh Kumar"),
    el("h1", undefined, "Class 8 mark check"),
    el(
      "p",
      "lede",
      "Reads data.csv from the 2023-24 register. Marks stay in this browser. Nothing is uploaded. Father names on the card are placeholders, not names from the school.",
    ),
  );

  const tools = el("div", "tools");
  const fileLabel = el("label", "file");
  fileLabel.append(el("span", undefined, "Drop a CSV or xlsx"));
  const input = el("input");
  input.type = "file";
  input.accept = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    void takeFile(file);
  });
  fileLabel.append(input);
  const reset = el("button", "text-button", "Back to data.csv");
  reset.type = "button";
  reset.addEventListener("click", () => {
    void store?.clearMarks();
    showReport(checkCsv(rawCsv), "data.csv", []);
  });
  const cards = el("button", "solid-button", "Make report cards");
  cards.type = "button";
  cards.addEventListener("click", () => {
    if (!state.report.ok) return;
    cards.disabled = true;
    cards.textContent = "Making cards…";
    const report = state.report;
    void buildCards(report, {
      fathers,
      layout: state.layout,
      generatedAt: new Date(),
      presetIsRegister: state.patternId === "register",
    })
      .then((bytes) => {
        const blob = new Blob([bytes.slice()], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        preview.hidden = false;
        preview.src = url;
        const download = document.createElement("a");
        download.href = url;
        download.download = `ms-yug-class-${report.className}-${report.session}-cards.pdf`;
        download.click();
      })
      .catch((error: unknown) => {
        bannerEl.className = "banner bad";
        bannerEl.textContent = error instanceof Error ? error.message : "Could not make the cards.";
      })
      .finally(() => {
        cards.disabled = false;
        cards.textContent = "Make report cards";
      });
  });
  tools.append(fileLabel, reset, cards);

  const layout = el("section", "panel");
  layout.append(
    el("h2", undefined, "Card layout"),
    el(
      "p",
      "quiet",
      "The default is the school card: father's line, F1–F6, and the unused-subject note. The print date is the day the PDF is made and is labeled as generated.",
    ),
  );
  layout.append(
    layoutToggle("layout-father", "Show father's placeholder name", "showFather"),
    layoutToggle("layout-formative", "Show F1–F6 columns", "showFormativeColumns"),
    layoutToggle("layout-unused", "Show the unused-subject note", "showUnusedNote"),
  );

  const pattern = el("section", "panel");
  pattern.append(el("h2", undefined, "Exam pattern"));
  const patternLabel = el("label", "file");
  patternLabel.append(el("span", undefined, "Preset"));
  const select = el("select");
  select.id = "pattern";
  for (const choice of PATTERN_CHOICES) {
    const option = el("option", undefined, choice.label);
    option.value = choice.id;
    select.append(option);
  }
  select.value = state.patternId;
  select.addEventListener("change", () => {
    state.patternId = select.value as PatternId;
    paintPattern();
    paintStudents();
  });
  patternLabel.append(select);
  const custom = el("div", "weights");
  custom.id = "custom-weights";
  custom.hidden = true;
  custom.append(
    weightInput("weight-fa", "Formative weight", "fa"),
    weightInput("weight-activities", "Co-curricular weight", "activities"),
    weightInput("weight-summative", "Summative weight", "summative"),
  );
  pattern.append(patternLabel, custom, patternSummary);

  const schedule = el("section", "panel");
  schedule.append(
    el("h2", undefined, "Exam schedule"),
    el(
      "p",
      "quiet",
      "Dates you type are entered on this page. They are not read from a school timetable, because there isn't one in the folder. A blank date is filled with the day you add the row and marked assumed.",
    ),
  );
  const form = el("form", "exam-form");
  form.append(
    field("exam-class", "Class", "text"),
    field("exam-subject", "Subject", "text"),
    field("exam-date", "Date", "date"),
    field("exam-room", "Room", "text"),
  );
  const add = el("button", "solid-button", "Add exam");
  add.type = "submit";
  const clear = el("button", "text-button", "Clear exams");
  clear.type = "button";
  form.append(add, clear);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const className = valueOf("exam-class");
    const subject = valueOf("exam-subject");
    const date = valueOf("exam-date");
    const room = valueOf("exam-room");
    if (!className || !subject) {
      examError.textContent = "Class and subject are needed.";
      return;
    }
    const draft = { className, subject, date, room };
    void (store ? store.addExam(draft) : Promise.resolve(pushMemoryExam(draft))).then((exams) => {
      state.exams = exams;
      form.reset();
      paintExams();
    });
  });
  clear.addEventListener("click", () => {
    void (store ? store.clearExams() : Promise.resolve()).then(() => {
      state.exams = [];
      paintExams();
    });
  });
  schedule.append(form, examError, examList);

  const trust = el("section", "trust");
  trust.append(
    el("h2", undefined, "Do not trust this for"),
    el(
      "p",
      undefined,
      "A missing mark, a grace mark the school has not written down, or a pass decision. The grade on the register preset is the grade already on the sheet. Other presets do not recompute it. The blank card says 2024-25; these rows are session 2023-24. Dogri/Additional stays visible as 0 and is left out of the counted total. Placeholder father names are not the school's names.",
    ),
  );

  app!.append(header, tools, layout, notesEl, bannerEl, metaEl, pattern, studentsEl, schedule, trust, preview);
  paint();
}

function layoutToggle(id: string, label: string, key: keyof CardLayout): HTMLLabelElement {
  const row = el("label", "check");
  const box = el("input");
  box.type = "checkbox";
  box.id = id;
  box.checked = state.layout[key];
  box.addEventListener("change", () => {
    state.layout[key] = box.checked;
  });
  row.append(box, el("span", undefined, label));
  return row;
}

function weightInput(id: string, label: string, key: keyof CustomWeights): HTMLLabelElement {
  const row = el("label", "file");
  row.append(el("span", undefined, label));
  const input = el("input");
  input.id = id;
  input.type = "number";
  input.value = String(state.weights[key]);
  input.addEventListener("change", () => {
    const parsed = Number(input.value);
    state.weights[key] = Number.isFinite(parsed) ? parsed : 0;
    paintPattern();
    paintStudents();
  });
  row.append(input);
  return row;
}

function field(id: string, label: string, type: string): HTMLLabelElement {
  const row = el("label", "file");
  row.append(el("span", undefined, label));
  const input = el("input");
  input.id = id;
  input.type = type;
  row.append(input);
  return row;
}

function valueOf(id: string): string {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  return input?.value.trim() ?? "";
}

function pushMemoryExam(draft: { className: string; subject: string; date: string; room: string }): ExamRow[] {
  const next = state.exams.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  state.exams = [...state.exams, prepareExam(draft, next)];
  return state.exams;
}

mount();

void openStore()
  .then(async (opened) => {
    store = opened;
    state.exams = await opened.readExams();
    state.dbNote = opened.persistent
      ? "Browser database is ready on this computer. data.csv is still what this screen shows until you drop a file."
      : "The browser database did not stay on disk. data.csv still loads. Exams stay until you refresh.";
    paintNotes();
    paintExams();
  })
  .catch((error: unknown) => {
    state.dbNote = error instanceof Error ? error.message : "The browser database did not start. data.csv still loads.";
    paintNotes();
  });
