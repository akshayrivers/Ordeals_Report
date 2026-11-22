import { examConflicts, examDateText, prepareExam, type ExamRow } from "../schedule";
import { state, store, subscribe } from "../state";
import { el } from "../ui";

export function mountSchedule(root: HTMLElement): void {
  const panel = el("section", "panel");
  panel.append(
    el("h2", undefined, "Schedule"),
    el(
      "p",
      "quiet",
      "The list starts empty. Dates you type are entered here. They are not read from a school timetable, because there isn't one in the folder. A blank date is the day you add the row, and it is labeled as assumed.",
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

  const examError = el("p", "exam-error");
  const examList = el("div", "exam-list");
  panel.append(form, examError, examList);
  root.append(panel);

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
    examError.textContent = "";
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

  function paintExams(): void {
    examList.replaceChildren();
    if (state.exams.length === 0) {
      examList.append(el("p", "quiet", "No exams yet. Nothing here was copied from a school timetable."));
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

  const stop = subscribe(() => {
    if (!root.isConnected) {
      stop();
      return;
    }
    paintExams();
  });
  paintExams();
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
