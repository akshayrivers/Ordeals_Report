import { el } from "../ui";

const JOBS = [
  {
    href: "#/import",
    label: "Import",
    text: "A full mark table, and one student at a time. Edits stay in this browser.",
  },
  {
    href: "#/marks",
    label: "Marks",
    text: "Pick a class, then open the exam format on its own view.",
  },
  {
    href: "#/schedule",
    label: "Schedule",
    text: "A month grid. Demo dates are labeled demo. The school workbook has no exam dates.",
  },
  {
    href: "#/cards",
    label: "Cards",
    text: "One card at a time, then paper size and margins, then a batch PDF.",
  },
];

export function mountHome(root: HTMLElement): void {
  const panel = el("section", "panel");
  panel.append(
    el("h2", undefined, "One job at a time"),
    el(
      "p",
      "quiet",
      "The page opens on made-up classes 1–8 so the screens are not empty. Switch to the real class 8 register when you want Student_01 from data.csv. Nothing is uploaded.",
    ),
  );
  const list = el("div", "jobs");
  for (const job of JOBS) {
    const link = el("a", "job");
    link.href = job.href;
    link.append(el("span", undefined, job.label), el("small", undefined, job.text));
    list.append(link);
  }
  panel.append(list);
  root.append(panel);
}
