import { mountCards } from "./pages/cards";
import { mountHome } from "./pages/home";
import { mountImport } from "./pages/import";
import { mountMarks } from "./pages/marks";
import { mountSchedule } from "./pages/schedule";
import { prepareExam } from "./schedule";
import { adoptWorking, publish, setStore, showDataset, state, subscribe } from "./state";
import { openStore } from "./store";
import "./style.css";
import { el } from "./ui";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app");

type Route = "home" | "import" | "marks" | "schedule" | "cards";

const NAV: { route: Route; href: string; label: string }[] = [
  { route: "home", href: "#/", label: "Home" },
  { route: "import", href: "#/import", label: "Import" },
  { route: "marks", href: "#/marks", label: "Marks" },
  { route: "schedule", href: "#/schedule", label: "Schedule" },
  { route: "cards", href: "#/cards", label: "Cards" },
];

function currentRoute(): Route {
  const raw = location.hash.replace(/^#/, "").replace(/^\//, "").split(/[?#]/)[0];
  if (raw === "import" || raw === "marks" || raw === "schedule" || raw === "cards") return raw;
  return "home";
}

const page = el("div", "page");

function shell(): void {
  const header = el("header", "topbar");
  const mark = el("div", "brand-mark", "YUG");
  mark.title = "Govt. Middle School Yug";
  const details = el("div", "topbar-details");
  details.append(
    el("p", "eyebrow", "Govt. Middle School Yug"),
    el("p", "school-name", "Zone Jib, Udhampur"),
    el("p", "sub", "For Suresh Kumar. Marks stay on this computer."),
  );
  header.append(mark, details);

  const nav = el("nav", "tabs");
  nav.setAttribute("aria-label", "School jobs");
  for (const item of NAV) {
    const link = el("a", undefined, item.label);
    link.href = item.href;
    link.dataset.route = item.route;
    nav.append(link);
  }

  const footer = el("footer");
  footer.append(
    el("span", undefined, "Govt. Middle School Yug · Zone Jib"),
    el("span", undefined, "Data stays on this computer"),
  );
  const dataset = el("div", "dataset");
  dataset.setAttribute("role", "group");
  dataset.setAttribute("aria-label", "Which set of rows is open");
  const demo = el("button", "chip", "Demo classes 1–8");
  demo.type = "button";
  demo.dataset.set = "demo";
  const real = el("button", "chip", "Real class 8 register");
  real.type = "button";
  real.dataset.set = "register";
  const datasetNote = el("p", "dataset-note");
  dataset.append(demo, real, datasetNote);
  demo.addEventListener("click", () => showDataset("demo"));
  real.addEventListener("click", () => showDataset("register"));

  app!.replaceChildren(header, nav, dataset, page, footer);

  const paintDataset = () => {
    const current = state.dataset;
    demo.classList.toggle("active", current === "demo");
    real.classList.toggle("active", current === "register");
    datasetNote.textContent =
      current === "demo"
        ? "Demo classes 1–8 are made up so the screens can be tried. They were not collected at the school. data.csv is not changed."
        : "Real class 8 register from data.csv. Session 2023-24. Edits stay in this browser and do not change the file.";
  };
  paintDataset();
  subscribe(paintDataset);
}

function renderRoute(): void {
  const route = currentRoute();
  for (const link of Array.from(app!.querySelectorAll<HTMLAnchorElement>("nav.tabs a"))) {
    const on = link.dataset.route === route;
    link.classList.toggle("active", on);
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  page.replaceChildren();
  if (route === "import") mountImport(page);
  else if (route === "marks") mountMarks(page);
  else if (route === "schedule") mountSchedule(page);
  else if (route === "cards") mountCards(page);
  else mountHome(page);
}

shell();
renderRoute();
window.addEventListener("hashchange", renderRoute);

void openStore()
  .then(async (opened) => {
    setStore(opened);
    state.exams = await opened.readExams();
    const demoSaved = await opened.readWorking("demo");
    const registerSaved = await opened.readWorking("register");
    if (demoSaved) adoptWorking("demo", demoSaved);
    if (registerSaved) adoptWorking("register", registerSaved);
    state.dbNote = opened.persistent
      ? "Browser database is ready on this computer. Edits stay here and do not change data.csv."
      : "The browser database did not stay on disk. The demo file and data.csv still load. Exams you add stay until you refresh.";
    publish();
  })
  .catch((error: unknown) => {
    state.dbNote = error instanceof Error ? error.message : "The browser database did not start. The demo file and data.csv still load.";
    publish();
  });

void fetch("/api/local-schedule")
  .then((response) => (response.ok ? response.json() : null))
  .then((data: { note?: string; exams?: { className: string; subject: string; date: string; room: string }[] } | null) => {
    if (!data) return;
    if (data.note) state.scheduleNote = data.note;
    state.parsedExams = (data.exams ?? []).map((exam, index) =>
      prepareExam({ ...exam, origin: "parsed" }, 20000 + index),
    );
    publish();
  })
  .catch(() => {
    /* The page already says no school timetable was loaded. */
  });
