import { applyClassUnused, LIMITS, type StudentResult } from "../check";
import {
  PATTERN_CHOICES,
  formatTotal,
  resolvePattern,
  scoreReport,
  type CustomWeights,
  type PatternId,
  type ScoreLine,
} from "../pattern";
import { state, subscribe } from "../state";
import { classChips, el, viewTabs } from "../ui";

type View = "students" | "format";

export function mountMarks(root: HTMLElement): void {
  let view: View = "students";
  let className = "";
  const panel = el("section", "panel");
  const intro = el(
    "p",
    "quiet",
    "Class check. On the register preset the total and the grade stay as written, and the rank is by that total. This page does not upload marks.",
  );
  const tabs = el("div");
  const body = el("div", "view-body");
  panel.append(el("h2", undefined, "Marks"), intro, tabs, body);
  root.append(panel);

  function students(): StudentResult[] {
    return state.report.ok ? state.report.students : [];
  }

  function classes(): string[] {
    return [...new Set(students().map((student) => student.className))].sort(
      (a, b) => Number(a) - Number(b) || a.localeCompare(b),
    );
  }

  function paintTabs(): void {
    tabs.replaceChildren(
      viewTabs(
        [
          { id: "students", label: "Students" },
          { id: "format", label: "Exam format" },
        ],
        view,
        (id) => {
          view = id as View;
          paint();
        },
      ),
    );
  }

  function paint(): void {
    paintTabs();
    body.replaceChildren();
    if (!state.report.ok) {
      const banner = el("p", "banner bad", state.report.error);
      body.append(banner);
      return;
    }
    const list = classes();
    if (!list.includes(className)) className = list[0] ?? "";
    if (view === "format") body.append(formatView());
    else body.append(studentsView(list));
  }

  function formatView(): HTMLElement {
    const block = el("div", "format-view");
    block.append(
      el("h3", undefined, "Exam format"),
      el(
        "p",
        "quiet",
        "This view is only the pattern. The student list is on Students. U1, U2, T1, and T2 are not invented when the file has no such column.",
      ),
    );
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
      paint();
    });
    patternLabel.append(select);
    block.append(patternLabel);

    const custom = el("div", "weights");
    custom.hidden = state.patternId !== "custom";
    custom.append(
      weightInput("weight-fa", "Formative weight", "fa"),
      weightInput("weight-activities", "Co-curricular weight", "activities"),
      weightInput("weight-summative", "Summative weight", "summative"),
    );
    block.append(custom);

    const resolved = resolvePattern(state.patternId, state.weights, students());
    const weights = resolved.parts.map((part) => `${part.label}: weight ${part.weight}, max ${part.max}`).join(" · ");
    block.append(el("p", "pattern-summary", `${weights}. Weights sum to ${resolved.weightSum}. ${resolved.note}`));
    if (state.dataset === "demo") {
      block.append(
        el(
          "p",
          "quiet",
          "On the demo file the grade says Dummy. That is a label so the column can be tried. It is not the school's scale.",
        ),
      );
    }
    const trust = el("div", "trust");
    trust.append(
      el("h3", undefined, "Do not trust this for"),
      el(
        "p",
        undefined,
        "A missing mark, a grace mark the school has not written down, or a pass decision. The grade on the register preset is the grade already written. Other presets do not recompute it.",
      ),
    );
    block.append(trust);
    return block;
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
      paint();
    });
    row.append(input);
    return row;
  }

  function studentsView(list: string[]): HTMLElement {
    const wrap = el("div");
    const report = state.report;
    if (!report.ok) return wrap;
    wrap.append(
      classChips(list, className, (value) => {
        className = value;
        paint();
      }),
    );
    const group = applyClassUnused(report.students.filter((student) => student.className === className));
    const resolved = resolvePattern(state.patternId, state.weights, group);
    wrap.append(
      el(
        "p",
        "meta",
        `Class ${className} · session ${report.session} · ${group.length} students · ${state.sourceLabel} · format ${resolved.label} · F max ${LIMITS.formative}, activities max ${LIMITS.coCurricular}, summative max ${LIMITS.summative}`,
      ),
    );
    const unused = group[0]?.subjects.filter((subject) => subject.unused).map((subject) => subject.cardName) ?? [];
    const unsafe = group.filter((student) => student.reasons.length > 0);
    const banner = el("p", unsafe.length ? "banner bad" : "banner ok");
    const parts: string[] = [];
    if (unused.length) {
      parts.push(
        `${unused.join(", ")} is 0 for every student in this class, so the counted total is out of ${group[0]?.countedMax ?? 500}, not 600.`,
      );
    }
    parts.push(
      unsafe.length
        ? `${unsafe.length} student${unsafe.length === 1 ? "" : "s"} failed a check.`
        : "No row failed the arithmetic.",
    );
    if (state.dataset === "demo") parts.push("Grades on this set say Dummy. That is not the school's scale.");
    banner.textContent = parts.join(" ");
    wrap.append(banner);
    const scores = scoreReport(group, resolved);
    const stack = el("div", "students");
    for (const student of group) stack.append(renderStudent(student, scores.find((line) => line.studentId === student.studentId)));
    wrap.append(stack);
    return wrap;
  }

  const stop = subscribe(() => {
    if (!root.isConnected) {
      stop();
      return;
    }
    paint();
  });
  paint();
}

function renderStudent(student: StudentResult, score: ScoreLine | undefined): HTMLElement {
  const card = el("article", student.reasons.length ? "student unsafe" : "student");
  card.dataset.student = student.studentId;
  const top = el("div", "top");
  const who = el("div");
  who.append(el("h3", undefined, student.studentId), el("p", "src", `Class ${student.className} · ${student.source}`));
  const scoreBox = el("div", "score");
  const grade = el("span", "grade", student.grade || "—");
  grade.dataset.grade = student.grade;
  const sheet = el("span", "sheet", student.grandTotal === null ? "—" : `${student.grandTotal} on the sheet`);
  sheet.dataset.total = student.grandTotal === null ? "" : String(student.grandTotal);
  scoreBox.append(
    grade,
    sheet,
    el("span", "counted", student.countedTotal === null ? "—" : `${student.countedTotal} / ${student.countedMax}`),
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
  if (/dummy/i.test(student.grade) || /dummy/i.test(student.remark)) {
    card.append(el("p", "src", "Dummy grade, not the school's scale."));
  }
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
