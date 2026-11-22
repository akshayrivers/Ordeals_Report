export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function viewTabs(
  views: { id: string; label: string }[],
  current: string,
  onChange: (id: string) => void,
): HTMLElement {
  const nav = el("div", "view-tabs");
  nav.setAttribute("role", "tablist");
  for (const view of views) {
    const button = el("button", view.id === current ? "active" : "", view.label);
    button.type = "button";
    button.dataset.view = view.id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", view.id === current ? "true" : "false");
    button.addEventListener("click", () => onChange(view.id));
    nav.append(button);
  }
  return nav;
}

export function classChips(
  classes: string[],
  current: string,
  onPick: (value: string) => void,
  includeAll = false,
): HTMLElement {
  const row = el("div", "chips");
  const items = includeAll ? ["all", ...classes] : classes;
  for (const item of items) {
    const button = el("button", item === current ? "chip active" : "chip", item === "all" ? "All classes" : `Class ${item}`);
    button.type = "button";
    button.addEventListener("click", () => onPick(item));
    row.append(button);
  }
  return row;
}
