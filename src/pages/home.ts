import { el } from "../ui";

const JOBS = [
  { href: "#/import", label: "Import", text: "Drop a CSV or xlsx. Accepted rows stay in the browser database." },
  { href: "#/marks", label: "Marks", text: "Class 8 check for session 2023-24. Pattern and rank sit on this page." },
  { href: "#/schedule", label: "Schedule", text: "An empty exam list. There is no school timetable in the folder." },
  { href: "#/cards", label: "Cards", text: "Report cards for 2023-24. Father names are placeholders." },
];

export function mountHome(root: HTMLElement): void {
  const panel = el("section", "panel");
  panel.append(
    el("h2", undefined, "One job at a time"),
    el(
      "p",
      "quiet",
      "Pick a job below. Import, marks, the exam list, and report cards are separate pages. Nothing is uploaded.",
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
