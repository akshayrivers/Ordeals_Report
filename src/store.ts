import initSqlJs, { type Database, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { MarkRow } from "./check";
import { prepareExam, type ExamDraft, type ExamRow } from "./schedule";

export type MarkStore = {
  persistent: boolean;
  replaceMarks(rows: MarkRow[], notes: string[]): Promise<{ rows: MarkRow[]; notes: string[] }>;
  clearMarks(): Promise<void>;
  readExams(): Promise<ExamRow[]>;
  addExam(draft: ExamDraft): Promise<ExamRow[]>;
  clearExams(): Promise<void>;
};

const DB_NAME = "ms-yug-local";
const STORE = "sqlite";

function text(value: SqlValue | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the browser database."));
  });
}

async function loadBytes(): Promise<Uint8Array | null> {
  if (typeof indexedDB === "undefined") return null;
  const idb = await openIndexedDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = idb.transaction(STORE, "readonly").objectStore(STORE).get("db");
      request.onsuccess = () => {
        const value = request.result as ArrayBuffer | Uint8Array | undefined;
        if (!value) resolve(null);
        else if (value instanceof Uint8Array) resolve(new Uint8Array(value));
        else resolve(new Uint8Array(value));
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    idb.close();
  }
}

async function saveBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openIndexedDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(bytes, "db");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    idb.close();
  }
}

function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mark_rows (
      id INTEGER PRIMARY KEY,
      student_id TEXT,
      class_name TEXT,
      session TEXT,
      subject TEXT,
      f1 TEXT, f2 TEXT, f3 TEXT, f4 TEXT, f5 TEXT, f6 TEXT,
      fa_total TEXT,
      co_curricular TEXT,
      summative TEXT,
      subject_total TEXT,
      grand_total TEXT,
      grade TEXT,
      remark TEXT,
      source TEXT,
      u1 TEXT,
      u2 TEXT,
      t1 TEXT,
      t2 TEXT
    );
    CREATE TABLE IF NOT EXISTS ingest_notes (
      id INTEGER PRIMARY KEY,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY,
      class_name TEXT,
      subject TEXT,
      exam_date TEXT,
      date_assumed INTEGER,
      room TEXT
    );
  `);
}

function readMarks(db: Database): MarkRow[] {
  const statement = db.prepare(
    `SELECT student_id, class_name, session, subject, f1, f2, f3, f4, f5, f6,
            fa_total, co_curricular, summative, subject_total, grand_total, grade, remark, source,
            u1, u2, t1, t2
     FROM mark_rows ORDER BY id`,
  );
  const rows: MarkRow[] = [];
  while (statement.step()) {
    const row = statement.getAsObject();
    rows.push({
      student_id: text(row.student_id),
      className: text(row.class_name),
      session: text(row.session),
      subject: text(row.subject),
      f1: text(row.f1),
      f2: text(row.f2),
      f3: text(row.f3),
      f4: text(row.f4),
      f5: text(row.f5),
      f6: text(row.f6),
      fa_total: text(row.fa_total),
      co_curricular: text(row.co_curricular),
      summative: text(row.summative),
      subject_total: text(row.subject_total),
      grand_total: text(row.grand_total),
      grade: text(row.grade),
      remark: text(row.remark),
      source: text(row.source),
      u1: text(row.u1),
      u2: text(row.u2),
      t1: text(row.t1),
      t2: text(row.t2),
    });
  }
  statement.free();
  return rows;
}

function readNotes(db: Database): string[] {
  const statement = db.prepare("SELECT note FROM ingest_notes ORDER BY id");
  const notes: string[] = [];
  while (statement.step()) notes.push(text(statement.getAsObject().note));
  statement.free();
  return notes;
}

function readExamRows(db: Database): ExamRow[] {
  const statement = db.prepare(
    "SELECT id, class_name, subject, exam_date, date_assumed, room FROM exams ORDER BY id",
  );
  const rows: ExamRow[] = [];
  while (statement.step()) {
    const row = statement.getAsObject();
    rows.push({
      id: Number(row.id),
      className: text(row.class_name),
      subject: text(row.subject),
      date: text(row.exam_date),
      dateAssumed: Number(row.date_assumed) === 1,
      room: text(row.room),
    });
  }
  statement.free();
  return rows;
}

export async function openStore(): Promise<MarkStore> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  let persistent = typeof indexedDB !== "undefined";
  let initial: Uint8Array | null = null;
  if (persistent) {
    try {
      initial = await loadBytes();
    } catch {
      persistent = false;
    }
  }
  let db: Database;
  try {
    db = initial ? new SQL.Database(initial) : new SQL.Database();
    migrate(db);
  } catch {
    db = new SQL.Database();
    migrate(db);
  }

  const persist = async () => {
    if (!persistent) return;
    try {
      await saveBytes(new Uint8Array(db.export()));
    } catch {
      persistent = false;
    }
  };

  return {
    get persistent() {
      return persistent;
    },
    async replaceMarks(rows, notes) {
      db.exec("BEGIN");
      try {
        db.run("DELETE FROM mark_rows");
        db.run("DELETE FROM ingest_notes");
        const insert = db.prepare(
          `INSERT INTO mark_rows (
            student_id, class_name, session, subject, f1, f2, f3, f4, f5, f6,
            fa_total, co_curricular, summative, subject_total, grand_total, grade, remark, source,
            u1, u2, t1, t2
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const row of rows) {
          insert.run([
            row.student_id,
            row.className,
            row.session,
            row.subject,
            row.f1,
            row.f2,
            row.f3,
            row.f4,
            row.f5,
            row.f6,
            row.fa_total,
            row.co_curricular,
            row.summative,
            row.subject_total,
            row.grand_total,
            row.grade,
            row.remark,
            row.source,
            row.u1,
            row.u2,
            row.t1,
            row.t2,
          ]);
        }
        insert.free();
        const noteInsert = db.prepare("INSERT INTO ingest_notes (note) VALUES (?)");
        for (const note of notes) noteInsert.run([note]);
        noteInsert.free();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      await persist();
      return { rows: readMarks(db), notes: readNotes(db) };
    },
    async clearMarks() {
      db.run("DELETE FROM mark_rows");
      db.run("DELETE FROM ingest_notes");
      await persist();
    },
    async readExams() {
      return readExamRows(db);
    },
    async addExam(draft) {
      const existing = readExamRows(db);
      const nextId = existing.reduce((max, row) => Math.max(max, row.id), 0) + 1;
      const exam = prepareExam(draft, nextId);
      db.run("INSERT INTO exams (id, class_name, subject, exam_date, date_assumed, room) VALUES (?, ?, ?, ?, ?, ?)", [
        exam.id,
        exam.className,
        exam.subject,
        exam.date,
        exam.dateAssumed ? 1 : 0,
        exam.room,
      ]);
      await persist();
      return readExamRows(db);
    },
    async clearExams() {
      db.run("DELETE FROM exams");
      await persist();
    },
  };
}
