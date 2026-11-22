import { mountCards } from "./pages/cards";
import { mountHome } from "./pages/home";
import { mountImport } from "./pages/import";
import { mountMarks } from "./pages/marks";
import { mountSchedule } from "./pages/schedule";
import { publish, setStore, state } from "./state";
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
  app!.replaceChildren(header, nav, page, footer);
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
    state.dbNote = opened.persistent
      ? "Browser database is ready on this computer. data.csv is what Marks shows until you drop a file."
      : "The browser database did not stay on disk. data.csv still loads. Exams stay until you refresh.";
    publish();
  })
  .catch((error: unknown) => {
    state.dbNote = error instanceof Error ? error.message : "The browser database did not start. data.csv still loads.";
    publish();
  });
