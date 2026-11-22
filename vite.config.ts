import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { scanWorkbook } from "./src/localSchedule";

/** sql.js assigns `module = undefined` inside its loader. Vite serves that file as ESM. */
function sqlJsModuleFix(): Plugin {
  return {
    name: "sqljs-module-fix",
    transform(code, id) {
      if (!/sql-wasm(?:-browser)?\.js/.test(id) || id.includes(".wasm")) return null;
      let next = code;
      if (!next.includes("var module = { exports: {} }")) {
        next = `var module = { exports: {} };\nvar exports = module.exports;\n${next}`;
      }
      next = next.replace("module.exports.default = initSqlJs;", "");
      if (next.includes("\n        module = undefined;") && !next.includes("var module = undefined")) {
        next = next.replace("\n        module = undefined;", "\n        var module = undefined;");
      }
      if (!next.includes("export default initSqlJs")) {
        next += "\nexport default initSqlJs;\n";
      }
      return next;
    },
  };
}

function localSchedulePlugin(): Plugin {
  return {
    name: "local-schedule",
    configureServer(server) {
      server.middlewares.use("/api/local-schedule", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        const empty = "The workbook in local/ has no exam-date column, so no school timetable was loaded.";
        try {
          const dir = path.resolve(server.config.root, "local");
          const names = fs.existsSync(dir)
            ? fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".xlsx"))
            : [];
          if (names.length === 0) {
            res.end(JSON.stringify({ note: "No workbook was found in local/, so no school timetable was loaded.", exams: [] }));
            return;
          }
          const scans = names.map((name) => scanWorkbook(fs.readFileSync(path.join(dir, name))));
          const exams = scans.flatMap((scan) => scan.exams);
          const note = exams.length
            ? "Exam dates from the workbook are marked as parsed from the file."
            : (scans.find((scan) => scan.note)?.note ?? empty);
          res.end(JSON.stringify({ note, exams }));
        } catch {
          res.end(
            JSON.stringify({
              note: "The workbook in local/ could not be read, so no school timetable was loaded.",
              exams: [],
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
  },
  optimizeDeps: {
    exclude: ["sql.js"],
  },
  plugins: [sqlJsModuleFix(), localSchedulePlugin()],
});
