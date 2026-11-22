import { CARD_ORDER, LIMITS, type StudentResult } from "../check";
import {
  PATTERN_CHOICES,
  formatTotal,
  resolvePattern,
  scoreReport,
  type CustomWeights,
  type PatternId,
  type ScoreLine,
} from "../pattern";
import { state } from "../state";
import { el } from "../ui";

const CARD_LABEL: Record<(typeof CARD_ORDER)[number], string> = {
  English: "English",
  "Urdu/Hindi": "Hindi/Urdu",
  Mathematics: "Mathematics",
  Science: "Science/EVS",
  "Social Science": "Social Science",
  "Kashmiri/Dogri/Punjabi": "Dogri/Additional",
};

function patternNow() {
  const students = state.report.ok ? state.report.students : [];
  return resolvePattern(state.patternId, state.weights, students);
}

function scoresNow(): ScoreLine[] {
  if (!state.report.ok) return [];
  return scoreReport(state.report.students, patternNow());
}

export function mountMarks(root: HTMLElement): void {
  const panel = el("section", "panel");
  panel.append(
    el("h2", undefined, "Marks"),
    el(
      "p",
      "quiet",
      "Class 8 check. The total and the grade are the ones on the sheet. Rank is by that total on the register pattern. This page does not upload marks.",
    ),
  );

  const bannerEl = el("p", "banner");
  const metaEl = el("p", "meta");
  const patternSummary = el("p", "pattern-summary");
  const studentsEl = el("div", "students");

  const pattern = el("div", "block");
  pattern.append(el("h3", undefined, "Exam pattern"));
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
  custom.hidden = state.patternId !== "custom";
  custom.append(
    weightInput("weight-fa", "Formative weight", "fa"),
    weightInput("weight-activities", "Co-curricular weight", "activities"),
    weightInput("weight-summative", "Summative weight", "summative"),
  );
  pattern.append(patternLabel, custom, patternSummary);

  const trust = el("div", "trust");
  trust.append(
    el("h3", undefined, "Do not trust this for"),
    el(
      "p",
      undefined,
      "A missing mark, a grace mark the school has not written down, or a pass decision. The grade on the register preset is the grade already on the sheet. Other presets do not recompute it.",
    ),
  );

  panel.append(bannerEl, metaEl, pattern, studentsEl, trust);
  root.append(panel);
  paintBanner();
  paintPattern();
  paintStudents();

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
    const resolved = patternNow();
    const weights = resolved.parts
      .map((part) => `${part.label}: weight ${part.weight}, max ${part.max}`)
      .join(" · ");
    patternSummary.textContent = `${weights}. Weights sum to ${resolved.weightSum}. ${resolved.note}`;
    custom.hidden = state.patternId !== "custom";
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
}

function renderStudent(student: StudentResult, score: ScoreLine | undefined): HTMLElement {
  const card = el("article", student.reasons.length ? "student unsafe" : "student");
  const top = el("div", "top");
  const who = el("div");
  who.append(el("h3", undefined, student.studentId), el("p", "src", student.source));
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
