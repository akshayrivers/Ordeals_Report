import { PAPER_RATIO, clampLayout, type CardLayout } from "./cards";
import type { Report, StudentResult } from "./check";
import { printDateLine } from "./dates";
import { el } from "./ui";

type Ready = Extract<Report, { ok: true }>;

function cell(tag: "td" | "th", text: string, name = false): HTMLTableCellElement {
  const node = el(tag, name ? "name" : undefined, text);
  return node;
}

export function paintSchoolCard(
  student: StudentResult,
  report: Ready,
  father: string,
  layoutIn: CardLayout,
  caption: string,
): HTMLElement {
  const layout = clampLayout(layoutIn);
  const stage = el("div", "card-stage");
  stage.append(el("p", "quiet", caption));

  const paper = el("article", "paper");
  paper.dataset.paper = layout.paper;
  paper.dataset.roll = student.studentId;
  paper.dataset.grade = student.grade;
  paper.dataset.grand = student.grandTotal === null ? "" : String(student.grandTotal);
  paper.dataset.className = student.className;
  paper.style.aspectRatio = PAPER_RATIO[layout.paper];
  paper.style.padding = `${layout.marginMm}mm`;
  paper.style.setProperty("--scale", String(layout.scale));
  paper.style.setProperty("--row", `${layout.rowHeight}px`);

  const inner = el("div", "paper-inner");
  inner.append(el("h3", "card-school", "GOVT. MIDDLE SCHOOL YUG (ZONE JIB)"));
  inner.append(el("p", "card-title", "REPORT CARD"));

  const fields = el("div", "card-fields");
  fields.append(field("NAME", "", "name"));
  fields.append(field("CLASS", student.className || report.className, "class"));
  if (layout.showFather) fields.append(field("FATHER'S NAME", father, "father"));
  fields.append(field("ROLL NO.", student.studentId, "roll"));
  fields.append(field("GRADE", student.grade, "grade"));
  fields.append(field("YEAR", report.session, "year"));
  inner.append(fields);
  inner.append(el("p", "card-print", printDateLine(new Date())));

  const table = el("table", "card-table");
  const head = el("tr");
  head.append(cell("th", "Subject", true));
  if (layout.showFormativeColumns) {
    for (let index = 1; index <= 6; index += 1) head.append(cell("th", `F${index}`));
  }
  head.append(cell("th", "Total (30)"), cell("th", "Activities"), cell("th", "Summative"), cell("th", "Total"));
  const thead = el("thead");
  thead.append(head);
  const body = el("tbody");
  for (const subject of student.subjects) {
    const row = el("tr");
    row.append(cell("td", subject.cardName, true));
    if (layout.showFormativeColumns) {
      for (const key of ["f1", "f2", "f3", "f4", "f5", "f6"] as const) {
        row.append(cell("td", subject.marks[key] === null ? "" : String(subject.marks[key])));
      }
    }
    row.append(
      cell("td", subject.marks.fa === null ? "" : String(subject.marks.fa)),
      cell("td", subject.marks.activities === null ? "" : String(subject.marks.activities)),
      cell("td", subject.marks.summative === null ? "" : String(subject.marks.summative)),
      cell("td", subject.total === null ? "" : String(subject.total)),
    );
    body.append(row);
  }
  const grand = el("tr", "grand");
  const grandCell = cell("td", "GRAND TOTAL", true);
  grand.append(grandCell);
  const span = (layout.showFormativeColumns ? 6 : 0) + 3;
  const blank = cell("td", "");
  blank.colSpan = span;
  grand.append(blank);
  const total = cell("td", student.grandTotal === null ? "" : String(student.grandTotal));
  total.dataset.grand = total.textContent ?? "";
  grand.append(total);
  body.append(grand);
  table.append(thead, body);
  inner.append(table);

  const result = el("p", "card-result");
  result.append(el("span", undefined, "RESULT"));
  if (student.remark) result.append(el("b", undefined, student.remark));
  inner.append(result);

  const unused = student.subjects.filter((subject) => subject.unused).map((subject) => subject.cardName);
  if (layout.showUnusedNote && unused.length) {
    inner.append(
      el(
        "p",
        "card-note",
        `${unused.join(", ")} is 0 for every student in this class, so a percentage is out of ${student.countedMax}, not 600.`,
      ),
    );
  }
  const signs = el("div", "card-signs");
  signs.append(el("span", undefined, "INCHARGE"), el("span", undefined, "HEADMASTER"));
  inner.append(signs);
  paper.append(inner);
  stage.append(paper);
  return stage;
}

function field(label: string, value: string, kind: string): HTMLParagraphElement {
  const row = el("p");
  row.append(el("span", undefined, label));
  const text = el("b");
  text.dataset.field = kind;
  text.textContent = value;
  row.append(text);
  return row;
}
