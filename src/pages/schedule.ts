import { examConflicts, examDateText, prepareExam, type ExamRow } from "../schedule";
import { state, store, subscribe, visibleExams } from "../state";
import { el } from "../ui";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function mountSchedule(root: HTMLElement): void {
  const first = state.demoExams[0]?.date ?? "";
  const [startYear, startMonth] = /^\d{4}-\d{2}-\d{2}$/.test(first)
    ? first.split("-").map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1];
  let year = startYear;
  let month = startMonth - 1;
  let chosen = "";

  const panel = el("section", "panel");
  panel.append(
    el("h2", undefined, "Schedule"),
    el(
      "p",
      "quiet",
      "Each day is scheduled or unscheduled. Click a day to see the exams, or to add one. A blank date becomes the day you add the row, and it is labeled assumed.",
    ),
  );
  const note = el("p", "banner");
  const demoNote = el("p", "quiet");
  const layout = el("div", "month-layout");
  const gridWrap = el("div");
  const dayPanel = el("div", "day-panel");
  layout.append(gridWrap, dayPanel);
  panel.append(note, demoNote, layout);
  root.append(panel);

  function paint(): void {
    note.className = "banner";
    note.textContent = state.scheduleNote;
    demoNote.textContent =
      state.dataset === "demo"
        ? "Dates marked Demo were made up for this month. They were not read from the school workbook."
        : "";
    const exams = visibleExams();
    const clashes = examConflicts(exams);
    gridWrap.replaceChildren();
    const bar = el("div", "month-bar");
    const prev = el("button", "text-button", "Previous month");
    prev.type = "button";
    prev.addEventListener("click", () => {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      chosen = "";
      paint();
    });
    const next = el("button", "text-button", "Next month");
    next.type = "button";
    next.addEventListener("click", () => {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      chosen = "";
      paint();
    });
    bar.append(prev, el("h3", undefined, `${MONTHS[month]} ${year}`), next);
    gridWrap.append(bar);
    if (clashes.length) {
      const box = el("div", "banner bad");
      for (const clash of clashes) box.append(el("p", undefined, clash));
      gridWrap.append(box);
    }
    gridWrap.append(monthGrid(year, month, exams));
    paintDay(exams);
  }

  function monthGrid(gridYear: number, gridMonth: number, exams: ExamRow[]): HTMLElement {
    const grid = el("div", "month-grid");
    grid.dataset.month = `${gridYear}-${String(gridMonth + 1).padStart(2, "0")}`;
    for (const label of WEEK) grid.append(el("span", "dow", label));
    const firstDay = new Date(gridYear, gridMonth, 1).getDay();
    const count = new Date(gridYear, gridMonth + 1, 0).getDate();
    for (let blank = 0; blank < firstDay; blank += 1) grid.append(el("span", "day empty"));
    for (let day = 1; day <= count; day += 1) {
      const iso = `${gridYear}-${String(gridMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const onDay = exams.filter((exam) => exam.date === iso);
      const button = el("button", "day");
      button.type = "button";
      if (onDay.length) button.classList.add("scheduled");
      if (iso === chosen) button.classList.add("chosen");
      button.append(el("span", "num", String(day)));
      button.append(el("span", "tag", onDay.length ? "Scheduled" : "Unscheduled"));
      if (onDay.some((exam) => exam.origin === "dummy")) button.append(el("small", undefined, "Demo"));
      if (onDay.some((exam) => exam.origin === "parsed")) button.append(el("small", undefined, "From file"));
      button.addEventListener("click", () => {
        chosen = iso;
        paint();
      });
      grid.append(button);
    }
    return grid;
  }

  function paintDay(exams: ExamRow[]): void {
    dayPanel.replaceChildren();
    if (!chosen) {
      dayPanel.append(el("h3", undefined, "Day"), el("p", "quiet", "Click a day to see its exams or to add one."));
      return;
    }
    const [y, m, d] = chosen.split("-").map(Number);
    const when = new Date(y, m - 1, d);
    dayPanel.append(el("h3", undefined, `${WEEK[when.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`));
    const onDay = exams.filter((exam) => exam.date === chosen);
    if (onDay.length === 0) dayPanel.append(el("p", "quiet", "Unscheduled. Add an exam for this day."));
    else {
      const list = el("ul", "exams");
      for (const exam of onDay) {
        const room = !exam.room
          ? "Room is blank, so this row is not part of a room check."
          : /^room\b/i.test(exam.room)
            ? exam.room
            : `Room ${exam.room}`;
        const item = el("li");
        item.textContent = `Class ${exam.className} · ${exam.subject} · ${examDateText(exam)} · ${room}`;
        list.append(item);
      }
      dayPanel.append(list);
    }
    dayPanel.append(addForm());
  }

  function addForm(): HTMLFormElement {
    const form = el("form", "exam-form");
    form.append(
      labeled("day-class", "Class", "text", ""),
      labeled("day-subject", "Subject", "text", ""),
      labeled("day-date", "Date", "date", chosen),
      labeled("day-room", "Room", "text", ""),
    );
    const add = el("button", "solid-button", "Add exam");
    add.type = "submit";
    const clear = el("button", "text-button", "Clear exams I added");
    clear.type = "button";
    form.append(add, clear);
    const error = el("p", "exam-error");
    form.append(error);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const className = formValue(form, "day-class");
      const subject = formValue(form, "day-subject");
      const date = formValue(form, "day-date");
      const room = formValue(form, "day-room");
      if (!className || !subject) {
        error.textContent = "Class and subject are needed.";
        return;
      }
      error.textContent = "";
      const draft = { className, subject, date, room };
      void (store ? store.addExam(draft) : Promise.resolve(pushMemoryExam(draft))).then((exams) => {
        state.exams = exams;
        if (!date) chosen = exams[exams.length - 1]?.date ?? chosen;
        paint();
      });
    });
    clear.addEventListener("click", () => {
      void (store ? store.clearExams() : Promise.resolve()).then(() => {
        state.exams = [];
        paint();
      });
    });
    return form;
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

function labeled(name: string, label: string, type: string, value: string): HTMLLabelElement {
  const row = el("label", "file");
  row.append(el("span", undefined, label));
  const input = el("input");
  input.name = name;
  input.type = type;
  input.value = value;
  row.append(input);
  return row;
}

function formValue(form: HTMLFormElement, name: string): string {
  const input = form.elements.namedItem(name);
  if (input instanceof HTMLInputElement) return input.value.trim();
  return "";
}

function pushMemoryExam(draft: { className: string; subject: string; date: string; room: string }): ExamRow[] {
  const next = state.exams.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  state.exams = [...state.exams, prepareExam(draft, next)];
  return state.exams;
}
