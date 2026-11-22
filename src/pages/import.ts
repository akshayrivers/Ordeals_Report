import { checkCsv, checkRows } from "../check";
import { ingestCsv, ingestXlsx, scrubSecrets } from "../ingest";
import { bundledCsv, publish, state, store, subscribe } from "../state";
import { el } from "../ui";

export function mountImport(root: HTMLElement): void {
  const panel = el("section", "panel");
  panel.append(
    el("h2", undefined, "Import"),
    el(
      "p",
      "quiet",
      "Drop a CSV or xlsx. The header does not have to be on row 1. Accepted rows are stored in the browser database on this computer. Duplicate rows are flagged and not merged. Nothing is uploaded.",
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
    state.report = checkCsv(bundledCsv);
    state.sourceLabel = "data.csv";
    state.importError = "";
    state.notes = ["Showing data.csv again. Stored marks were cleared from the browser database."];
    paint();
    publish();
  });
  tools.append(fileLabel, reset);

  const notesEl = el("div", "notes");
  const bannerEl = el("p", "banner");
  bannerEl.hidden = true;

  panel.append(tools, notesEl, bannerEl);
  root.append(panel);

  function paint(): void {
    notesEl.replaceChildren();
    if (state.dbNote) notesEl.append(el("p", undefined, state.dbNote));
    for (const note of state.notes) notesEl.append(el("p", undefined, note));
    notesEl.hidden = notesEl.childElementCount === 0;
    if (state.importError) {
      bannerEl.hidden = false;
      bannerEl.className = "banner bad";
      bannerEl.textContent = state.importError;
      return;
    }
    if (!state.report.ok && state.sourceLabel !== "data.csv") {
      bannerEl.hidden = false;
      bannerEl.className = "banner bad";
      bannerEl.textContent = state.report.error;
      return;
    }
    if (state.sourceLabel !== "data.csv" && state.report.ok) {
      bannerEl.hidden = false;
      bannerEl.className = "banner ok";
      bannerEl.textContent = `${state.sourceLabel} is stored. Open Marks to read ${state.report.students.length} students.`;
      return;
    }
    bannerEl.hidden = true;
    bannerEl.textContent = "";
  }

  async function takeFile(file: File): Promise<void> {
    bannerEl.hidden = false;
    bannerEl.className = "banner";
    bannerEl.textContent = `Reading ${file.name} on this computer…`;
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
    state.importError = "";
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
    state.notes = notes;
    state.sourceLabel = file.name;
    state.report = result.shape === "canonical-csv" ? checkCsv(new TextDecoder().decode(bytes)) : checkRows(rows);
    if (root.isConnected) paint();
    publish();
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
