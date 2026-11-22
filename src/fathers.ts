import { parseCsvTable } from "./check";

const HEADER = ["student_id", "father_name_placeholder"];

/** Stable stand-ins from placeholders/fathers.csv. Missing ids stay blank. */
export function parseFathers(text: string): Record<string, string> {
  const table = parseCsvTable(text);
  if (table.length === 0) return {};
  const header = table[0].map((cell) => cell.trim());
  if (header.join(",") !== HEADER.join(",")) return {};
  const fathers: Record<string, string> = {};
  for (const cells of table.slice(1)) {
    const id = (cells[0] ?? "").trim();
    const name = (cells[1] ?? "").trim();
    if (id && name) fathers[id] = name;
  }
  return fathers;
}
