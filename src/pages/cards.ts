import { paintSchoolCard } from "../cardPaint";
import { buildCards, clampLayout, type PaperSize } from "../cards";
import { presentForPrint, type StudentResult } from "../check";
import { fatherMap, state, subscribe } from "../state";
import { classChips, el, viewTabs } from "../ui";

type View = "card" | "layout" | "batch";

export function mountCards(root: HTMLElement): void {
  let view: View = "card";
  let className = "";
  let index = 0;
  let batchAll = false;
  let statusText = "";

  const panel = el("section", "panel");
  const tabs = el("div");
  const body = el("div", "view-body");
  panel.append(
    el("h2", undefined, "Report cards"),
    el(
      "p",
      "quiet",
      "One student at a time, then the paper size, then a batch PDF. The print date is the day the PDF is made and is labeled as generated. The real register year stays 2023-24.",
    ),
    tabs,
    body,
  );
  root.append(panel);

  function readyStudents(): StudentResult[] {
    return state.report.ok ? state.report.students : [];
  }

  function classes(): string[] {
    return [...new Set(readyStudents().map((student) => student.className))].sort(
      (a, b) => Number(a) - Number(b) || a.localeCompare(b),
    );
  }

  function groupFor(name: string): StudentResult[] {
    return presentForPrint(readyStudents().filter((student) => student.className === name));
  }

  function caption(): string {
    if (state.dataset === "demo") {
      return "Demo card from dummy/school.csv. The name stays blank. The father line is a stand-in, not a name from the school.";
    }
    return "School card for the class 8 register. The name stays blank. The father line is a placeholder. The year is 2023-24.";
  }

  function paintTabs(): void {
    tabs.replaceChildren(
      viewTabs(
        [
          { id: "card", label: "Card" },
          { id: "layout", label: "Layout" },
          { id: "batch", label: "Batch PDF" },
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
      body.append(el("p", "banner bad", state.report.error));
      return;
    }
    const list = classes();
    if (!list.includes(className)) className = list[0] ?? "";
    const group = groupFor(className);
    if (index >= group.length) index = 0;
    if (view === "card") body.append(cardView(list, group));
    else if (view === "layout") body.append(layoutView(group));
    else body.append(batchView(list, group));
  }

  function cardView(list: string[], group: StudentResult[]): HTMLElement {
    const wrap = el("div");
    wrap.append(
      classChips(list, className, (value) => {
        className = value;
        index = 0;
        paint();
      }),
    );
    const student = group[index];
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
    next.disabled = index >= group.length - 1;
    next.addEventListener("click", () => {
      index += 1;
      paint();
    });
    pager.append(prev, el("span", undefined, student ? `${index + 1} of ${group.length}` : "No students"), next);
    wrap.append(pager);
    if (student) wrap.append(paintSchoolCard(student, state.report as Extract<typeof state.report, { ok: true }>, fatherMap()[student.studentId] ?? "", state.layout, caption()));
    return wrap;
  }

  function layoutView(group: StudentResult[]): HTMLElement {
    const split = el("div", "split");
    const controls = el("div", "config-card");
    controls.append(
      el("h3", undefined, "Paper and size"),
      el("p", "quiet", "Numbers update the preview. The school card is the starting point: A4, father's name, F1–F6, and the unused-subject note."),
    );
    controls.append(paperSelect(), numberField("Margin (mm)", state.layout.marginMm, 8, 36, 1, (value) => {
      state.layout.marginMm = value;
    }), numberField("Scale", state.layout.scale, 0.75, 1.4, 0.05, (value) => {
      state.layout.scale = value;
    }), numberField("Row height", state.layout.rowHeight, 16, 48, 1, (value) => {
      state.layout.rowHeight = value;
    }));
    controls.append(
      toggle("Show father's placeholder name", state.layout.showFather, (checked) => {
        state.layout.showFather = checked;
      }),
      toggle("Show F1–F6 columns", state.layout.showFormativeColumns, (checked) => {
        state.layout.showFormativeColumns = checked;
      }),
      toggle("Show the unused-subject note", state.layout.showUnusedNote, (checked) => {
        state.layout.showUnusedNote = checked;
      }),
    );
    const preview = el("div");
    const student = group[index] ?? group[0];
    const draw = () => {
      state.layout = clampLayout(state.layout);
      preview.replaceChildren();
      if (!student || !state.report.ok) return;
      preview.append(paintSchoolCard(student, state.report, fatherMap()[student.studentId] ?? "", state.layout, caption()));
    };
    for (const input of Array.from(controls.querySelectorAll("input, select"))) {
      input.addEventListener("input", draw);
      input.addEventListener("change", draw);
    }
    draw();
    split.append(controls, preview);
    return split;
  }

  function batchView(list: string[], group: StudentResult[]): HTMLElement {
    const wrap = el("div");
    const layout = clampLayout(state.layout);
    const blocks = [
      layout.showFather ? "father's placeholder" : "",
      layout.showFormativeColumns ? "F1–F6" : "",
      layout.showUnusedNote ? "unused-subject note" : "",
    ].filter(Boolean);
    wrap.append(
      el(
        "p",
        "quiet",
        `${layout.paper}, margin ${layout.marginMm} mm, scale ${layout.scale}, row height ${layout.rowHeight}. Showing ${blocks.join(", ") || "no optional blocks"}. The print date is generated, not a school date.`,
      ),
    );
    const scope = el("div", "chips");
    const one = el("button", batchAll ? "chip" : "chip active", `Class ${className}`);
    one.type = "button";
    const all = el("button", batchAll ? "chip active" : "chip", "All classes in this set");
    all.type = "button";
    one.addEventListener("click", () => {
      batchAll = false;
      paint();
    });
    all.addEventListener("click", () => {
      batchAll = true;
      paint();
    });
    scope.append(one, all);
    wrap.append(scope);
    if (!batchAll) {
      wrap.append(
        classChips(list, className, (value) => {
          className = value;
          paint();
        }),
      );
    }
    const make = el("button", "solid-button", "Make report cards");
    make.type = "button";
    const status = el("p", "exam-error", statusText);
    const preview = el("iframe", "preview");
    preview.title = "Report card preview";
    preview.hidden = true;
    make.addEventListener("click", () => {
      if (!state.report.ok) {
        status.textContent = state.report.error;
        return;
      }
      const report = state.report;
      const chosen = batchAll ? presentForPrint(report.students) : group;
      make.disabled = true;
      make.textContent = "Making cards…";
      status.textContent = "";
      void buildCards(
        { ...report, className: batchAll ? report.className : className, students: chosen },
        {
          fathers: fatherMap(),
          layout: state.layout,
          generatedAt: new Date(),
          presetIsRegister: state.patternId === "register",
        },
      )
        .then((bytes) => {
          const blob = new Blob([bytes.slice()], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          preview.hidden = false;
          preview.src = url;
          const download = document.createElement("a");
          download.href = url;
          download.download = `ms-yug-${state.dataset}-cards.pdf`;
          download.click();
          statusText = `Made ${chosen.length} cards. The print date is the generation date.`;
          status.textContent = statusText;
        })
        .catch((error: unknown) => {
          statusText = error instanceof Error ? error.message : "Could not make the cards.";
          status.textContent = statusText;
        })
        .finally(() => {
          make.disabled = false;
          make.textContent = "Make report cards";
        });
    });
    wrap.append(make, status, preview);
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

function paperSelect(): HTMLLabelElement {
  const row = el("label", "file");
  row.append(el("span", undefined, "Paper"));
  const select = el("select");
  for (const size of ["A4", "A5", "Letter"] as PaperSize[]) {
    const option = el("option", undefined, size === "A4" ? "A4 (school default)" : size);
    option.value = size;
    select.append(option);
  }
  select.value = state.layout.paper;
  select.addEventListener("change", () => {
    state.layout.paper = select.value as PaperSize;
  });
  row.append(select);
  return row;
}

function numberField(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (value: number) => void,
): HTMLLabelElement {
  const row = el("label", "file");
  row.append(el("span", undefined, label));
  const input = el("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("input", () => {
    const parsed = Number(input.value);
    if (Number.isFinite(parsed)) onChange(parsed);
  });
  row.append(input);
  return row;
}

function toggle(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
  const row = el("label", "toggle");
  const box = el("input");
  box.type = "checkbox";
  box.checked = checked;
  box.addEventListener("change", () => onChange(box.checked));
  row.append(box, el("span", undefined, label));
  return row;
}
