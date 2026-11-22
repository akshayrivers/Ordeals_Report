import { assumedDatePhrase, generationStamp } from "./dates";

export type ExamOrigin = "entered" | "dummy" | "parsed";

export type ExamRow = {
  id: number;
  className: string;
  subject: string;
  date: string;
  dateAssumed: boolean;
  room: string;
  origin: ExamOrigin;
};

export type ExamDraft = {
  className: string;
  subject: string;
  date: string;
  room: string;
  now?: Date;
  origin?: ExamOrigin;
};

export function prepareExam(draft: ExamDraft, id: number): ExamRow {
  const now = draft.now ?? new Date();
  const typed = draft.date.trim();
  const assumed = typed === "";
  return {
    id,
    className: draft.className.trim(),
    subject: draft.subject.trim(),
    date: assumed ? generationStamp(now).iso : typed,
    dateAssumed: assumed,
    room: draft.room.trim(),
    origin: draft.origin ?? "entered",
  };
}

export function examDateText(row: ExamRow): string {
  if (row.origin === "dummy") return `${row.date} (demo date, not from the school)`;
  if (row.origin === "parsed") return `${row.date} (parsed from the file)`;
  if (!row.dateAssumed) return row.date;
  const [year, month, day] = row.date.split("-").map((part) => Number(part));
  if (!year || !month || !day) return `${row.date} (assumed — generated, not a date from the school)`;
  return assumedDatePhrase(new Date(year, month - 1, day));
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Same room and date, or the same class in two rooms on one date. */
export function examConflicts(rows: ExamRow[]): string[] {
  const messages: string[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (a.date !== b.date) continue;
      const when = `${examDateText(a)}`;
      const roomA = a.room.trim();
      const roomB = b.room.trim();
      if (roomA !== "" && roomB !== "" && sameText(roomA, roomB)) {
        messages.push(
          `${label(a)} and ${label(b)} are both in ${roomA} on ${when}.`,
        );
      }
      if (sameText(a.className, b.className) && roomA !== "" && roomB !== "" && !sameText(roomA, roomB)) {
        messages.push(`Class ${a.className} is in ${roomA} and ${roomB} on ${when}.`);
      }
    }
  }
  return messages;
}

function label(row: ExamRow): string {
  const subject = row.subject || "an exam";
  const className = row.className || "a class";
  return `${className} ${subject}`;
}
