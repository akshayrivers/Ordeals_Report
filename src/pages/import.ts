import { checkCsv, type MarkRow } from "../check";
import { editMark } from "../edits";
import { ingestCsv, ingestXlsx, scrubSecrets } from "../ingest";
import {
  addExtraColumn,
  blockedExtraValue,
  editWorkingRows,
  replaceWorkingRows,
  restoreRegister,
  rowKey,
  setExtraValue,
  state,
  store,
  subscribe,
} from "../state";
import { classChips, el, viewTabs } from "../ui";

type View = "table" | "one";

const MARKS = [
  ["f1", "F1"],
  ["f2", "F2"],
  ["f3", "F3"],
  ["f4", "F4"],
  ["f5", "F5"],
  ["f6", "F6"],
  ["fa_total", "FA"],
  ["co_curricular", "Activities"],
  ["summative", "Summative"],
  ["subject_total", "Total"],
] as const;

export function mountImport(root: HTMLElement): void {
  let view: View = "table";
  let className = "all";
  let index = 0;
  let editNote = "";

  const panel = el("section", "panel");
  const tabs = el("div");
  const tools = el("div", "tools");
  const body = el("div", "view-body");
  panel.append(
    el("h2", undefined, "Import"),
    el(
      "p",
      "quiet",
      "Two ways to read the same rows. Change a mark here and Marks and Cards follow. Added fields stay in this browser. data.csv is not rewritten.",
    ),
    tabs,
    tools,
    body,
  );
  root.append(panel);

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
    void restoreRegister().then(() => {
      editNote = "";
      paint();
    });
  });
  tools.append(fileLabel, reset);

  function ids(): string[] {
    const seen: string[] = [];
    for (const row of state.rows) {
      if (!seen.includes(row.student_id)) seen.push(row.student_id);
    }
    return seen;
  }

  function classes(): string[] {
    return [...new Set(state.rows.map((row) => row.className))].sort(
      (a, b) => Number(a) - Number(b) || a.localeCompare(b),
    );
  }

  function paintTabs(): void {
    tabs.replaceChildren(
      viewTabs(
        [
          { id: "table", label: "All students" },
          { id: "one", label: "One student" },
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
    const notes = el("div", "notes");
    if (state.dbNote) notes.append(el("p", undefined, state.dbNote));
    for (const note of state.notes) notes.append(el("p", undefined, note));
    if (state.importError) notes.append(el("p", "banner bad", state.importError));
    if (editNote) notes.append(el("p", "banner bad", editNote));
    body.append(notes);
    if (!state.report.ok && state.rows.length === 0) {
      body.append(el("p", "banner bad", state.report.error));
      return;
    }
    const list = classes();
    if (className !== "all" && !list.includes(className)) className = "all";
    const people = ids();
    if (index >= people.length) index = 0;
    if (view === "table") body.append(tableView(list));
    else body.append(oneView(people));
  }

  function commit(next: MarkRow[]): void {
    editNote = "";
    editWorkingRows(next);
  }

  function tableView(list: string[]): HTMLElement {
    const wrap = el("div");
    wrap.append(
      classChips(
        list,
        className,
        (value) => {
          className = value;
          paint();
        },
        true,
      ),
    );
    wrap.append(fieldForm());
    const scroll = el("div", "table-scroll");
    const table = el("table");
    const head = el("tr");
    for (const label of ["Student", "Class", "Subject", ...MARKS.map(([, label]) => label), "Grand", "Grade"]) {
      head.append(el("th", undefined, label));
    }
    for (const column of state.extras.columns) head.append(el("th", undefined, column.label));
    const thead = el("thead");
    thead.append(head);
    const tbody = el("tbody");
    const rows = state.rows.filter((row) => className === "all" || row.className === className);
    for (const row of rows) {
      const line = el("tr");
      line.append(el("td", undefined, row.student_id), el("td", undefined, row.className), el("td", undefined, row.subject));
      for (const [field] of MARKS) {
        const cell = el("td");
        cell.append(markInput(row[field], (value) => commit(editMark(state.rows, row.student_id, row.subject, field, value))));
        line.append(cell);
      }
      const grand = el("td");
      grand.append(
        markInput(row.grand_total, (value) => commit(editMark(state.rows, row.student_id, row.subject, "grand_total", value)), true),
      );
      const grade = el("td");
      grade.append(
        markInput(row.grade, (value) => commit(editMark(state.rows, row.student_id, row.subject, "grade", value)), true),
      );
      line.append(grand, grade);
      const key = rowKey(row.student_id, row.subject);
      for (const column of state.extras.columns) {
        const cell = el("td");
        cell.append(
          markInput(state.extras.values[key]?.[column.key] ?? "", (value) => {
            const error = setExtraValue(key, column.key, value);
            editNote = error ?? "";
            if (error) paint();
          }, true),
        );
        line.append(cell);
      }
      tbody.append(line);
    }
    table.append(thead, tbody);
    scroll.append(table);
    wrap.append(scroll);
    return wrap;
  }

  function oneView(people: string[]): HTMLElement {
    const wrap = el("div", "single");
    const id = people[index] ?? "";
    const pager = el("div", "pager");
    const prev = el("button", "text-button", "Previous");
    prev.type = "button";
    prev.disabled = index <= 0;
    prev.addEventListener("click", () => {
      index -= 1;
      paint();
    });
    const next = el("button", "text-button", "Next");
    next.type = "button";
    next.disabled = index >= people.length - 1;
    next.addEventListener("click", () => {
      index += 1;
      paint();
    });
    const jump = el("select");
    people.forEach((person, personIndex) => {
      const option = el("option", undefined, person);
      option.value = String(personIndex);
      jump.append(option);
    });
    jump.value = String(index);
    jump.addEventListener("change", () => {
      index = Number(jump.value);
      paint();
    });
    pager.append(prev, el("span", undefined, people.length ? `${index + 1} of ${people.length}` : "No students"), next, jump);
    wrap.append(pager, fieldForm());
    const rows = state.rows.filter((row) => row.student_id === id);
    const first = rows[0];
    if (!first) return wrap;
    wrap.append(
      el("h3", undefined, id),
      el("p", "meta", `Class ${first.className} · session ${first.session} · grade ${first.grade} · grand total ${first.grand_total}`),
    );
    for (const row of rows) {
      const block = el("article", "subject-edit");
      block.append(el("h3", undefined, row.subject));
      const grid = el("div", "mark-grid");
      for (const [field, label] of MARKS) {
        const labelNode = el("label");
        labelNode.append(el("span", undefined, label));
        labelNode.append(markInput(row[field], (value) => commit(editMark(state.rows, row.student_id, row.subject, field, value))));
        grid.append(labelNode);
      }
      const grade = el("label");
      grade.append(el("span", undefined, "Grade"));
      grade.append(markInput(row.grade, (value) => commit(editMark(state.rows, row.student_id, row.subject, "grade", value)), true));
      const grand = el("label");
      grand.append(el("span", undefined, "Grand total"));
      grand.append(
        markInput(row.grand_total, (value) => commit(editMark(state.rows, row.student_id, row.subject, "grand_total", value)), true),
      );
      grid.append(grade, grand);
      const key = rowKey(row.student_id, row.subject);
      for (const column of state.extras.columns) {
        const extra = el("label");
        extra.append(el("span", undefined, column.label));
        extra.append(
          markInput(state.extras.values[key]?.[column.key] ?? "", (value) => {
            const error = setExtraValue(key, column.key, value);
            editNote = error ?? "";
            if (error) paint();
          }, true),
        );
        grid.append(extra);
      }
      block.append(grid);
      wrap.append(block);
    }
    return wrap;
  }

  function fieldForm(): HTMLElement {
    const form = el("form", "field-form");
    const label = el("label", "file");
    label.append(el("span", undefined, "Add a field"));
    const name = el("input");
    name.type = "text";
    name.placeholder = "Column name";
    label.append(name);
    const add = el("button", "text-button", "Add field");
    add.type = "submit";
    form.append(label, add);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const error = addExtraColumn(name.value);
      editNote = error ?? "";
      name.value = "";
      paint();
    });
    return form;
  }

  function markInput(value: string, onChange: (value: string) => void, wide = false): HTMLInputElement {
    const box = el("input");
    box.type = "text";
    box.value = value;
    box.className = wide ? "wide" : "mark";
    box.addEventListener("change", () => {
      if (blockedExtraValue(box.value) && wide && /[^\d.]/.test(box.value) === false && box.value.replace(/\D/g, "").length >= 12) {
        editNote = "That value looks like an Aadhaar or phone number, so it was not stored.";
        paint();
        return;
      }
      onChange(box.value.trim());
    });
    return box;
  }

  async function takeFile(file: File): Promise<void> {
    editNote = "";
    state.importError = "";
    state.notes = [`Reading ${file.name} on this computer…`];
    paint();
    const bytes = new Uint8Array(await file.arrayBuffer());
    await new Promise((resolve) => setTimeout(resolve, 0));
    const xlsx = file.name.toLowerCase().endsWith(".xlsx") || (bytes[0] === 0x50 && bytes[1] === 0x4b);
    const result = xlsx ? ingestXlsx(bytes.buffer) : ingestCsv(new TextDecoder().decode(bytes));
    if (!result.ok) {
      state.notes = result.notes;
      state.importError = result.error;
      if (root.isConnected) paint();
      return;
    }
    const scrubbed = scrubSecrets(result.rows);
    const notes = [...result.notes];
    if (scrubbed.scrubbed) notes.push("A phone-shaped or 12-digit number was in a kept cell and was left blank.");
    let rows = scrubbed.rows;
    if (store) {
      try {
        const saved = await store.replaceMarks(rows, notes);
        rows = saved.rows;
        notes.push(
          store.persistent
            ? `Stored ${rows.length} mark rows in the browser database on this computer. data.csv was not changed.`
            : `Kept ${rows.length} mark rows in memory for this page. data.csv was not changed.`,
        );
      } catch (error) {
        notes.push(error instanceof Error ? error.message : "The rows were not saved in the browser database.");
      }
    }
    if (result.shape === "canonical-csv") {
      const checked = checkCsv(new TextDecoder().decode(bytes));
      if (!checked.ok) {
        state.notes = notes;
        state.importError = checked.error;
        if (root.isConnected) paint();
        return;
      }
    }
    replaceWorkingRows(rows, file.name, notes);
    if (root.isConnected) paint();
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
