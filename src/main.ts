import rawCsv from "../data.csv?raw";
import { CARD_ORDER, LIMITS, checkCsv, type Report, type StudentResult } from "./check";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app");

const CARD_LABEL: Record<(typeof CARD_ORDER)[number], string> = {
  English: "English",
  "Urdu/Hindi": "Hindi/Urdu",
  Mathematics: "Mathematics",
  Science: "Science/EVS",
  "Social Science": "Social Science",
  "Kashmiri/Dogri/Punjabi": "Dogri/Additional",
};

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

function render(report: Report, sourceLabel: string): void {
  app!.replaceChildren();

  const header = el("header", "mast");
  header.append(
    el("p", "eyebrow", "Govt. Middle School Yug · Zone Jib · for Suresh Kumar"),
    el("h1", undefined, "Class 8 mark check"),
    el(
      "p",
      "lede",
      "Reads data.csv from the 2023-24 register. Marks stay in this browser. Nothing is uploaded.",
    ),
  );
  app!.append(header);

  const tools = el("div", "tools");
  const fileLabel = el("label", "file");
  fileLabel.append(el("span", undefined, "Feed another CSV"));
  const input = el("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => render(checkCsv(String(reader.result ?? "")), file.name);
    reader.readAsText(file);
  });
  fileLabel.append(input);
  const reset = el("button", "text-button", "Back to data.csv");
  reset.type = "button";
  reset.addEventListener("click", () => render(checkCsv(rawCsv), "data.csv"));
  tools.append(fileLabel, reset);
  app!.append(tools);

  if (!report.ok) {
    const error = el("p", "banner bad", report.error);
    app!.append(error);
    return;
  }

  const unusedNames = report.unusedSubjects.map((subject) => CARD_LABEL[subject as (typeof CARD_ORDER)[number]] ?? subject);
  const unsafeStudents = report.students.filter((student) => student.reasons.length > 0);
  const banner = el("p", unsafeStudents.length ? "banner bad" : "banner ok");
  if (unusedNames.length) {
    banner.textContent = `${unusedNames.join(", ")} is 0 for every student, so the counted total is out of ${report.students[0]?.countedMax ?? 500}, not 600. `;
  }
  banner.append(
    unsafeStudents.length
      ? `${unsafeStudents.length} student${unsafeStudents.length === 1 ? "" : "s"} failed a check.`
      : "No row failed the arithmetic.",
  );
  app!.append(banner);

  const meta = el(
    "p",
    "meta",
    `Class ${report.className} · session ${report.session} · ${report.students.length} students · ${sourceLabel} · F max ${LIMITS.formative}, activities max ${LIMITS.coCurricular}, summative max ${LIMITS.summative}`,
  );
  app!.append(meta);

  const list = el("div", "students");
  for (const student of report.students) list.append(renderStudent(student));
  app!.append(list);

  const trust = el("section", "trust");
  trust.append(
    el("h2", undefined, "Do not trust this for"),
    el(
      "p",
      undefined,
      "A missing mark, a grace mark the school has not written down, or a pass decision. The grade shown is the grade already on the register. The blank card says 2024-25; these rows are session 2023-24. Dogri/Additional stays visible as 0 and is left out of the counted total.",
    ),
  );
  app!.append(trust);
}

function renderStudent(student: StudentResult): HTMLElement {
  const card = el("article", student.reasons.length ? "student unsafe" : "student");
  const top = el("div", "top");
  const who = el("div");
  who.append(el("h2", undefined, student.studentId), el("p", "src", student.source));
  const score = el("div", "score");
  score.append(
    el("span", "grade", student.grade || "—"),
    el("span", "sheet", student.grandTotal === null ? "—" : `${student.grandTotal} on the sheet`),
    el(
      "span",
      "counted",
      student.countedTotal === null ? "—" : `${student.countedTotal} / ${student.countedMax}`,
    ),
  );
  top.append(
    who,
    score,
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

render(checkCsv(rawCsv), "data.csv");
