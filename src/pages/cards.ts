import { buildCards, type CardLayout } from "../cards";
import { fathers, state } from "../state";
import { el } from "../ui";

export function mountCards(root: HTMLElement): void {
  const panel = el("section", "panel");
  panel.append(
    el("h2", undefined, "Report cards"),
    el(
      "p",
      "quiet",
      "One PDF page per student, in the school layout. The year on the card stays 2023-24, the register session. Father's name is a stand-in from placeholders/fathers.csv, not a name from the school. The print date is the day the PDF is made and is labeled as generated.",
    ),
  );

  const layout = el("div", "block");
  layout.append(el("h3", undefined, "What the card shows"));
  layout.append(
    layoutToggle("layout-father", "Show father's placeholder name", "showFather"),
    layoutToggle("layout-formative", "Show F1–F6 columns", "showFormativeColumns"),
    layoutToggle("layout-unused", "Show the unused-subject note", "showUnusedNote"),
  );

  const tools = el("div", "tools");
  const cards = el("button", "solid-button", "Make report cards");
  cards.type = "button";
  const status = el("p", "exam-error");
  const preview = el("iframe", "preview");
  preview.title = "Report card preview";
  preview.hidden = true;

  cards.addEventListener("click", () => {
    if (!state.report.ok) {
      status.textContent = state.report.error;
      return;
    }
    cards.disabled = true;
    cards.textContent = "Making cards…";
    status.textContent = "";
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
        status.textContent = error instanceof Error ? error.message : "Could not make the cards.";
      })
      .finally(() => {
        cards.disabled = false;
        cards.textContent = "Make report cards";
      });
  });

  tools.append(cards);
  panel.append(layout, tools, status, preview);
  root.append(panel);
}

function layoutToggle(id: string, label: string, key: keyof CardLayout): HTMLLabelElement {
  const row = el("label", "toggle");
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
